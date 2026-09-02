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

Chaque image a un `src` et un `alt` obligatoire.

- URL `https://…` : utilisée telle quelle (cas actuel des visuels Hostinger).
- Fichier local : `src="images/mon-fichier.png"` et le fichier dans `contribution/images/mon-fichier.png`.

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

## Déployer (avec `.env`)

Le fichier `.env` à la racine n’est **pas** versionné. Il contient les identifiants Hostinger (`SSH_*` de préférence, sinon `FTP_*`). Sans ce fichier, le déploiement refuse de partir.

```bash
npm run deploy:check   # teste la connexion SSH ou FTP
npm run deploy         # compile le site (XML inclus) et l’envoie
```

Le build embarque les XML compilés. Le `.env` local n’est pas uploadé : les secrets de production restent sur le serveur.

SSH est utilisé si `SSH_USER` et `SSH_PASSWORD` sont remplis (port `65002` chez Hostinger). Sinon, repli sur FTP.

Commandes utiles :

```bash
npm run deploy:dry     # liste les fichiers sans les envoyer (sans rebuild)
```
