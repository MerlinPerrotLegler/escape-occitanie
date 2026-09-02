# Tableau de disponibilités horizontal — deux salles

Date: 2026-09-01  
Statut: validé

## Problème

Les réservations publiques passent par une page **par salle** (`/reservation/convocation-chez-le-directeur` et `/reservation/la-malediction-du-vaisseau-fantome`) et un calendrier mois. On ne peut pas comparer les deux salles sur la même vue, ni parcourir les créneaux en défilement horizontal.

Il n’existe pas de route `/reservation` (sans slug). Le CTA header « Réserver » envoie vers `/#salles`.

## Objectif

Un composant réutilisable `AvailabilityTimeline` affiche les créneaux des **deux salles** dans une grille :

- colonne gauche **fixe** : noms des salles
- zone droite **scroll horizontal** : date + heure, une colonne par créneau
- cellule ouverte → clic « Réserver »
- cellule fermée / passée / absente → « Non dispo »

Le même composant apparaît :

1. Sur une **nouvelle page** `/reservation`
2. Sur chaque **page salle**, sous le titre « Votre mission commence ici »

Un clic ouvre le **formulaire de réservation sous le tableau**, sans changer de page (partout). Pagination par **fenêtres de 7 jours d’ouverture**, jusqu’au dernier jour ouvert connu.

Approche retenue : **APIs existantes** (`fetchOpenPeriods`, `fetchDaySlots`). Pas de nouvel endpoint.

## Contraintes

- Fuseau **Europe/Paris**, comme le calendrier actuel.
- Deux salles uniquement, ordre `ROOM_LIST` : Directeur puis Vaisseau. Libellé colonne : `shortName`.
- Routes `/reservation/:salle` et `BookingCalendar` restent. On n’y ajoute pas le tableau horizontal.
- Pas de nouvel endpoint PHP.
- Extraire le formulaire actuel de `BookingCalendar` pour le partager (pas de second formulaire divergente). La spec de validation contact (si elle n’est pas encore merge) s’appliquera au composant extrait, pas en double.

## Architecture

```
/reservation                 ReservationPage → AvailabilityTimeline
/salles/:salle               RoomPage → AvailabilityTimeline (highlightRoom = slug)
Header « Réserver »          → /reservation

AvailabilityTimeline
  lib/availabilityTimeline.js     pages de 7 jours, colonnes, bookable?
  fetchOpenPeriods + fetchDaySlots (2 salles × jours de la page, en parallèle)
  BookingForm                     extrait de BookingCalendar
```

Fichiers prévus :

| Fichier | Rôle |
|---|---|
| `apps/web/src/lib/availabilityTimeline.js` | Fonctions pures testables |
| `apps/web/src/components/AvailabilityTimeline.jsx` | Tableau + pagination + formulaire |
| `apps/web/src/components/BookingForm.jsx` | Formulaire (extrait) |
| `apps/web/src/pages/ReservationPage.jsx` | Page `/reservation` |
| `apps/web/src/App.jsx` | Route exacte `/reservation` |
| `apps/web/src/pages/RoomPage.jsx` | Embed sous le titre |
| `apps/web/src/components/SiteHeader.jsx` | CTA → `/reservation` |
| `apps/web/src/components/BookingCalendar.jsx` | Utilise `BookingForm` |
| `apps/web/tools/test-availability-timeline.js` | Tests Node |

## Composant `AvailabilityTimeline`

Props :

- `highlightRoom` (string, optionnel) : slug à mettre en avant (page salle). Les deux lignes restent visibles.

Pas d’autres props. Les salles viennent de `ROOM_LIST`.

### Données

1. `todayISO` + `nowMinutes` en fuseau Paris.
2. `fetchOpenPeriods(todayISO, horizonIso(today))`.
3. Jours d’ouverture = dates `period_date` uniques, `>= todayISO`, triées. Un jour ouvert **reste dans la pagination même s’il est complet**.
4. Page `p` = `openIsos.slice(p * 7, p * 7 + 7)`. Dernière page plus courte si besoin.
5. Pour chaque jour de la page : `Promise.all` des `fetchDaySlots` des deux salles.
6. Changer de page relance l’étape 5. Les périodes ne sont fetchées qu’une fois. Si **un** `fetchDaySlots` de la page échoue, toute la page est en erreur (Réessayer).

### Colonnes

Pour chaque jour de la page, l’ensemble des heures est l’**union** des `time` renvoyés par les deux salles, triées. Chaque couple `(iso, time)` est une colonne.

Cellule salle R :

- `open` si cette salle a un slot `status === 'open'` à cette heure **et** le créneau n’est pas déjà passé (jour = aujourd’hui et `time` < maintenant Paris).
- sinon `unavailable` (réservé, fermé, hors plage de cette salle, ou passé).

Un jour sans aucun slot (période ouverte mais liste vide) produit **zéro colonne** pour ce jour : le jour compte quand même dans les 7 (bandeau date vide ou jour sauté visuellement — **décision : pas de colonnes**, le jour n’occupe pas d’espace horizontal).

### Pagination UI

- Flèches précédent / suivant (même esprit que le calendrier).
- Précédent désactivé sur la page 0.
- Suivant désactivé s’il n’y a plus de jours d’ouverture après la page courante.
- Libellé discret de la plage visible, ex. `1–7 sept.` (premier et dernier jour de la page).

### Tableau UI

```
              |  lun. 1 sept.                 |  mar. 2 sept.
              |  14:00    14:30    15:00      |  14:00   …
Le Directeur  |  [Réserver] Non dispo [Réserver] |  …
Le Vaisseau   |  Non dispo  [Réserver] [Réserver] |  …
```

- Première colonne sticky (fond opaque, z-index au-dessus du scroll).
- En-tête jour groupé au-dessus des heures de ce jour (`lun. 1 sept.` via `fr-FR`, sans l’année si l’année = année courante Paris).
- Cellule `open` : bouton « Réserver ». `aria-label` : `Réserver {shortName}, {date longue} à {heure}`.
- Cellule `unavailable` : texte « Non dispo », pas un bouton.
- Créneau sélectionné : même surbrillance que le calendrier (`border-primary bg-primary/15`).
- `highlightRoom` : fond légèrement plus marqué sur la ligne.

### Formulaire

Clic sur un créneau `open` :

- sélectionne `{ room, iso, time }`
- affiche `BookingForm` **sous** le tableau (pas une modale)
- titre du formulaire : `{date longue} à {heure} — {room.name} — 60 min`

Champs, envoi `createBooking`, toasts et écran de succès : **identiques** à `BookingCalendar` (via `BookingForm` partagé).

Après succès : le slot choisi passe `unavailable` dans l’état local (pas de refetch). L’écran de succès reste visible jusqu’à un clic sur un autre créneau, ou un changement de page (dans les deux cas on quitte le succès).

Changer de page pendant un formulaire non envoyé abandonne la sélection, sans confirmation. Changer de créneau remplace simplement la sélection (même formulaire, nouveau titre).

### États

| Situation | Affichage |
|---|---|
| Chargement périodes ou slots | Skeleton du tableau (2 lignes) |
| Aucun jour d’ouverture | « Aucune date ouverte pour le moment. » |
| Échec fetch périodes ou slots | « Impossible de charger les disponibilités. » + bouton Réessayer |
| Page dont tous les jours n’ont aucune colonne | Message « Aucun horaire sur ces dates. » + pagination toujours utilisable |

Erreur `createBooking` : toast, formulaire inchangé.

## Page `/reservation`

- Route **exacte** `/reservation` dans `PublicLayout` (header/footer). Les routes `/reservation/:salle` inchangées.
- Titre : « Réservation ». Intro courte : comparer les deux salles et réserver un créneau.
- SEO : title `Réservation — Escape Occitanie`, description sur les deux salles / 60 min.
- Le composant occupe la largeur du contenu (`max-w-6xl`), pas une colonne latérale.

## Page salle

Dans la section Histoire, **juste sous** le `h2` « Votre mission commence ici », **pleine largeur de la section** (le titre sort du grid 3/2). Ensuite le grid actuel (texte + infos pratiques) inchangé.

`highlightRoom={room.slug}`.

Le bouton hero « Réserver cette salle » et l’aside « Voir les disponibilités » restent sur `room.bookingPath` (calendrier de cette salle).

## Header

Les deux CTA « Réserver » / « Réserver une session » (desktop et mobile) pointent vers `/reservation`. Footer et accueil `/#salles` : **inchangés**.

## Helpers purs (`availabilityTimeline.js`)

- `PAGE_SIZE = 7`
- `openDayIsos(periodDates, todayISO)` → dates uniques `>= todayISO`, triées
- `pageSlice(openIsos, pageIndex, pageSize = 7)` → `{ days, pageIndex, pageCount, hasPrev, hasNext }`
- `isSlotBookable(slot, { iso, todayISO, nowMinutes })` → booléen (`status === 'open'` et pas dans le passé)
- `buildColumns(days, slotsByRoomByDate, { todayISO, nowMinutes, roomSlugs })` → liste `{ iso, time, cells: { [slug]: 'open' \| 'unavailable' } }`

`nowMinutes` = minutes depuis minuit Paris (même calcul que `BookingCalendar`).

## Tests

`apps/web/tools/test-availability-timeline.js` (même style `expect` que `test-calendar-months.js`) :

- pagination : 0 jour, 7 jours (1 page), 8 jours (2 pages, dernière de 1), `hasNext` / `hasPrev`
- `openDayIsos` ignore le passé, déduplique
- `isSlotBookable` : open futur OK ; open passé aujourd’hui KO ; reserved KO
- `buildColumns` : union des heures ; salle A open / salle B absente → unavailable ; jour sans slots → 0 colonnes pour ce jour

Vérification navigateur avant clôture :

- `/reservation` : scroll, sticky, 2 lignes, pagination
- clic → formulaire sous le tableau, envoi (ou abandon)
- page salle : tableau sous le titre, ligne highlight
- header Réserver → `/reservation`
- `/reservation/convocation-chez-le-directeur` toujours le calendrier mois

## Hors scope

- Endpoint batch `availability` multi-salles
- Fusionner le calendrier mois et le tableau
- Changer footer / CTA accueil `/#salles`
- Sélecteur de salle unique (les deux lignes sont toujours là)
- Deep-link `?date=&heure=` sur `/reservation` (les pages par salle le gardent)
