# Escape Occitanie

Les textes et images de la vitrine se trouvent dans `contribution/`. On les édite, on prévisualise en local, puis on déploie si un fichier `.env` est présent à la racine du dépôt.

Les avis, le hall of fame, le planning et les réservations se gèrent dans Maître Thibault (`/maitre`), pas dans ces XML.

## Contribuer les XML

| Fichier | Contenu |
|---|---|
| `contribution/commun.xml` | Marque, menu, pied de page, page 404, boutons communs aux salles |
| `contribution/accueil.xml` | Accueil (SEO, hero, bandeau, expérience, titres des blocs) |
| `contribution/directeur.xml` | Salle Convocation chez le Directeur |
| `contribution/vaisseau.xml` | Salle La Malédiction du Vaisseau Fantôme |
| `contribution/contact.xml` | Adresse, téléphone, e-mail, réseaux, logo |
| `contribution/reserver.xml` | Page réservation (étapes, calendrier, messages du formulaire) |
| `contribution/emails.xml` | Sujets des e-mails + chemin du fichier MJML |
| `contribution/emails/*.mjml` | Corps HTML des e-mails |

On **modifie le texte à l’intérieur des balises**, pas les noms de balises, pas les `slug` (`directeur`, `vaisseau`), pas les `id` des e-mails.

Caractères spéciaux XML : `&` s’écrit `&amp;`, `<` s’écrit `&lt;`.

Quelques textes contiennent des variables entre accolades (`{nom-court}`, `{nom}`, `{date}`, `{heure}`, …). Les laisser telles quelles : elles sont remplies à l’affichage ou à l’envoi du mail.

### Images

Chaque image a un `src` et un `alt` obligatoire. Les photos de galerie ont aussi une `legende`.

Deux formes de `src` :

**URL** (visuels Hostinger actuels) — laissée telle quelle, pas de fichier dans le dépôt :

```xml
<image src="https://images.hostinger.com/….png" alt="Couloir sombre d'un escape game"/>
<logo src="https://horizons-cdn.hostinger.com/…/logo.jpg" alt="Escape Occitanie"/>
```

**Fichier local** — `src` commence toujours par `images/`, le fichier est dans `contribution/images/` :

```xml
<image src="images/accueil-hero.png" alt="Couloir sombre d'un escape game"/>
<photo src="images/directeur-galerie-1.png" alt="Loupe sur des notes" legende="Les indices de l'inspecteur"/>
```

À la compile, le fichier est recopié vers `/media/…` et le site utilise ce chemin (`images/accueil-hero.png` → `/media/accueil-hero.png`). Un sous-dossier est possible : `images/salles/hero.png` → `/media/salles/hero.png`. Fichier manquant, `src` ni URL ni `images/…` : la compile s’arrête.

En local (`npm run dev`), `/media/…` est servi par Vite. Au `npm run deploy`, ces fichiers partent avec le site. S’il est activé, le CDN Hostinger du domaine les cache : pas d’envoi séparé vers `images.hostinger.com`.

Les e-mails (`{logo}`, `{image_salle}`) reprennent le logo de `contact.xml` et l’image de la salle réservée. Une URL `https://…` est collée telle quelle. Un fichier local devient `https://escapeoccitanie.fr/media/…` (le `<site>` de `contact.xml`) : Gmail et consorts n’affichent pas un chemin `/media/…`.

L’envoi lui-même est indépendant des images : `HOSTINGER_EMAIL_MCP_TOKEN` (+ `HOSTINGER_MAIL_MAILBOX_ID` si besoin) dans le `.env` du serveur, pas dans les XML.

Chaque salle a **exactement 3** photos dans `<galerie>`. Accueil : **3** stats et **4** atouts. Réservation : **3** étapes.

### Prévisualiser

Node.js 22 (voir `.nvmrc`). À la racine du dépôt :

```bash
npm install
npm run dev
```

Le site s’ouvre sur [http://localhost:3000](http://localhost:3000). Enregistrer un XML recharge la page. Si rien ne change, relancer `npm run dev`.

XML cassé, image locale manquante ou galerie incomplète : la compile s’arrête et affiche le fichier en cause. On peut aussi lancer uniquement la compile :

```bash
npm run compile:content --prefix apps/web
```

### Turnstile (anti-robot réservation)

Le formulaire public de réservation utilise Cloudflare Turnstile quand les deux clés sont présentes (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` dans `.env` / `api/.env` serveur).

Sans clés, si Cloudflare est injoignable, ou s’il n’y a plus de quota / secret invalide : **le captcha s’éteint tout seul**, la réservation continue.

En local, sans compte Cloudflare, coller les clés dummy always-pass :

```
TURNSTILE_SITE_KEY="1x00000000000000000000AA"
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
```

Puis relancer `npm run dev` (PHP relit le `.env`).

En production : créer un widget **Managed** sur [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile), hostnames = `localhost` + le domaine public. `npm run deploy` recopie ces clés dans `api/.env` distant. Les dummy locales suffisent pour un test visuel ; remplace-les par les vraies clés dès que le widget Cloudflare est créé.

## Déployer (avec `.env`)

Le fichier `.env` à la racine n’est **pas** versionné. Il contient les identifiants Hostinger (`SSH_*` de préférence, sinon `FTP_*`). Sans ce fichier, le déploiement refuse de partir.

```bash
npm run deploy:check   # teste la connexion SSH ou FTP
npm run deploy         # compile le site (XML inclus) et l’envoie
```

Le build embarque les XML compilés et les images locales recopiées dans `/media/`. Le `.env` local n’est pas uploadé : les secrets de production restent sur le serveur.

SSH est utilisé si `SSH_USER` et `SSH_PASSWORD` sont remplis (port `65002` chez Hostinger). Sinon, repli sur FTP.

Commandes utiles :

```bash
npm run deploy:dry     # liste les fichiers sans les envoyer (sans rebuild)
```
