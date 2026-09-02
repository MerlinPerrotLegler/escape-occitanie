# Demander un avis — boutons backoffice + mail

Date: 2026-09-02  
Statut: validé en conversation

## Problème

Après une partie, Maître Thibault décide, réservation par réservation relance le client pour un avis Google / Facebook / Instagram.

## Objectif

Dans **Réservations**, un filtre **Avis** liste les parties confirmées **d’hier et avant**, sans décision. Deux boutons à usage unique : **Demander un avis** (envoie le mail) et **Ne pas demander d’avis**. Dès le lendemain calendaire, Modifier / Renvoyer l’e-mail / Annuler disparaissent — c’est le même seuil.

Approche retenue : **déclenchement manuel**, pas de cron Hostinger.

## Éligibilité

Fuseau **Europe/Paris**. Seuil = **le lendemain calendaire** de `booking_date` (`booking_date < aujourd’hui`).

`booking_date`, c’est **le jour de la partie** (la date affichée sur la réservation), pas `created_at` (le moment où le client a réservé en ligne). L’heure du créneau (`start_minute`) ne compte pas.

Une réservation **prévue aujourd’hui** reste **éditable** toute la journée. À partir de minuit le lendemain de ce jour-là, elle n’est **plus modifiable** et, si elle est confirmée sans décision, les boutons d’avis apparaissent.

Exemple : réservé le 15 août pour une partie le **1er septembre** → éditable jusqu’au 1er septembre inclus ; avis à partir du **2 septembre**.

Éligible à un avis si :

- `booking_date < aujourd’hui` (Paris)
- `status = confirmed`
- `review_ask` est vide (`NULL`)

Exemples (partie le 1er septembre, n’importe quelle heure) :

| Maintenant (Paris) | Hors édition | Éligible avis (si confirmée, sans décision) |
|---|---|---|
| 1er sept. 23:59 | non | non |
| 2 sept. 00:00 | oui | oui |

## Bureau (Maître Thibault)

Filtres existants inchangés : Aujourd’hui, À confirmer, Toutes. **Avis** s’ajoute à côté.

Le filtre **Avis** ne contient que les éligibles, tri **date puis heure décroissantes** (les plus récentes d’abord). Message vide : `Aucun avis à demander.`

Le hash `#reservations?filtre=avis` suit le même schéma que les autres. `parseBookingFilter` / `mt_normalize_booking_filter` acceptent `avis`. Le filtre par défaut (à confirmer s’il y a des pending, sinon aujourd’hui) **ne bascule pas** tout seul sur Avis. Pas de pastille de compteur.

### Boutons par ligne (hors annulées, déjà sans actions)


| Situation | Boutons |
|---|---|
| `booking_date` = aujourd’hui (ou futur) | comme aujourd’hui : Confirmer si pending, Annuler, Modifier, Renvoyer l’e-mail |
| Lendemain+ + pending | **Confirmer** uniquement |
| Lendemain+ + confirmée + `review_ask` vide | **Demander un avis**, **Ne pas demander d’avis** |
| Lendemain+ + confirmée + déjà décidé | aucun |


Après un clic réussi : les deux boutons disparaissent, la ligne sort du filtre Avis. **Aucun libellé** « Avis demandé » / « Pas d’avis » dans Toutes.

Toasts : même style que « Renvoyer l’e-mail » (succès / échec d’envoi).

Le front n’invente pas l’horloge : l’API envoie `review_ask`, `can_ask_review`, `past_actions` sur chaque réservation (snake_case comme `guest_name`). Le JSX lit ces flags.

## Données

Colonne `bookings.review_ask` : `VARCHAR(16) NULL` (valeurs `sent`, `skipped`, ou `NULL`). Ajoutée dans `mt_ensure_bookings_schema` comme `ics_sequence` (`CREATE TABLE` + `ALTER` si absente).

`mt_booking_select_sql` / `mt_map_booking_rows` exposent `review_ask` (`null` \| `'sent'` \| `'skipped'`), `can_ask_review` (bool), `past_actions` (bool).

## API

Session manager obligatoire, comme confirm / mail.


| Action                 | Requête                                             |
| ---------------------- | --------------------------------------------------- |
| Envoyer le mail d’avis | `POST /api/bookings.php?id={id}&action=review-ask`  |
| Ne pas demander        | `POST /api/bookings.php?id={id}&action=review-skip` |


Les deux ne passent que si la réservation est encore éligible. Mise à jour atomique : `UPDATE … WHERE id = ? AND review_ask IS NULL` (après les contrôles de statut / date). Concurrent : 409.

**Demander un avis** : envoyer le mail **puis** écrire `sent`. Si l’envoi échoue : `review_ask` reste `NULL`, HTTP 200 `{ booking, emailSent: false }` — les boutons restent, second essai possible. Succès : `{ booking, emailSent: true }`.

**Ne pas demander** : écrire `skipped`, pas de mail. `{ booking }`.

Erreurs :


| Cas                                     | HTTP |
| --------------------------------------- | ---- |
| Pas de session                          | 401  |
| Introuvable                             | 404  |
| Annulée, pending, trop tôt, déjà décidé | 400  |


`GET /api/bookings.php?filtre=avis` : SQL `status = 'confirmed' AND review_ask IS NULL AND booking_date < aujourd’hui (Paris)`, pagination existante (10 / page).

Annuler / modifier / renvoyer l’e-mail **côté API** : inchangés (le bureau masque seulement les boutons). Confirmer un pending d’hier ou avant reste possible.

Helpers PHP testables : `past_actions` = `booking_date < mt_today_paris()`, `can_ask_review`. Pas de table SQL supplémentaire.

Clients JS : `requestBookingReview(id)` / `skipBookingReview(id)` dans `booking.js`.

## Mail

Nouveau template `contribution/emails.xml` id `client-avis`.

- Sujet : `Un petit mot après votre partie — Escape Occitanie`
- MJML : même habillage que `client-attente` (fond sombre, logo, photo de salle).
- Trois boutons : Google, Facebook, Instagram.

Placeholders PHP (en plus de `{nom}`, `{salle}`, `{date}`, `{heure}`, `{logo}`, `{image_salle}`, …) :


| Placeholder          | Source                          |
| -------------------- | ------------------------------- |
| `{lien_avis_google}` | `contact.xml` → `<avis-google>` |
| `{lien_facebook}`    | `<facebook>` existant           |
| `{lien_instagram}`   | `<instagram>` existant          |


`<avis-google>` est obligatoire au compile (comme `facebook`). Seed :

`https://search.google.com/local/writereview?cid=6874570004777222413`

(CID de la fiche Maps actuelle `0x12b23bbf554c6b7d:0x5f6760ff0e4d410d`.)

Texte : remercier pour la partie `{salle}` du `{date}` ; demander un avis **Google** et **Facebook** ; pour **Instagram**, suivre / mentionner (pas d’avis Instagram). Filet `mail.php` si `site-copy.json` absent : mêmes phrases en texte brut.

`EMAIL_IDS` du compile inclut `client-avis`. `mt_booking_copy_vars` fournit les trois liens. Envoi via `mt_send_mail` (HTML + texte), **sans** ICS.

## Tests

- PHP : même jour encore éditable, lendemain éligible (minuit Paris), filtre avis, skip, ask qui n’écrit `sent` que si le mail part, refus trop tôt / pending / cancelled / déjà décidé, concurrence `WHERE review_ask IS NULL`.
- JS : `parseBookingFilter('avis')`, hash `#reservations?filtre=avis`.
- Compile : `client-avis` manquant → build KO ; fixture `contact.xml` avec `<avis-google>`.
- Mail copy : sujet, placeholders remplis, pas d’ICS.
- Navigateur (Maître Thibault) : filtre Avis, les deux boutons, disparition silencieuse, masquage Modifier / Renvoyer / Annuler dès le lendemain, Confirmer encore visible sur un pending ancien, Aujourd’hui / À confirmer / Toutes inchangés.



## Hors scope

- Cron / envoi automatique.
- Libellé d’état avis dans le tableau.
- Pastille de compteur sur le filtre Avis.
- Changer Facebook / Instagram (URLs déjà dans `contact.xml`).
- Bloquer PATCH / DELETE / resend côté API pour les résas d’hier et avant.
- Éditeur Maître Thibault pour le MJML.

