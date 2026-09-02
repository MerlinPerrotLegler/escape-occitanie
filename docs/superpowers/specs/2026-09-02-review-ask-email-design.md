# Demander un avis — boutons backoffice + page publique

Date: 2026-09-02  
Statut: validé en conversation

## Problème

Après une partie, Maître Thibault relance le client pour un avis. Un mail long avec trois boutons se partage mal. Mieux : **un lien unique** vers une page, que le joueur peut aussi transmettre au reste de l’équipe.

## Objectif

Dans **Réservations**, un filtre **Avis** liste les parties confirmées **d’hier et avant**, sans décision. Maître Thibault envoie **un lien** (mail, ou copie pour coller ailleurs). La **page publique** porte Google, Facebook, Instagram, et insiste pour que le destinataire la partage aux autres joueurs.

Dès le lendemain calendaire, Modifier / Renvoyer l’e-mail / Annuler disparaissent — même seuil.

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

| Maintenant (Paris) | Hors édition | Éligible avis (si confirmée, sans décision) |
|---|---|---|
| 1er sept. 23:59 | non | non |
| 2 sept. 00:00 | oui | oui |

## Bureau (Maître Thibault)

Filtres existants inchangés : Aujourd’hui, À confirmer, Toutes. **Avis** s’ajoute à côté.

Le filtre **Avis** ne contient que les éligibles, tri **date puis heure décroissantes**. Message vide : `Aucun avis à demander.`

Le hash `#reservations?filtre=avis` suit le même schéma. `parseBookingFilter` / `mt_normalize_booking_filter` acceptent `avis`. Le filtre par défaut **ne bascule pas** tout seul sur Avis. Pas de pastille de compteur.

### Boutons par ligne (hors annulées, déjà sans actions)

| Situation | Boutons |
|---|---|
| `booking_date` = aujourd’hui (ou futur) | comme aujourd’hui : Confirmer si pending, Annuler, Modifier, Renvoyer l’e-mail |
| Lendemain+ + pending | **Confirmer** uniquement |
| Lendemain+ + confirmée + `review_ask` vide | **Demander un avis**, **Copier le lien**, **Ne pas demander d’avis** |
| Lendemain+ + confirmée + `sent` | **Copier le lien** |
| Lendemain+ + confirmée + `skipped` | aucun |

- **Demander un avis** : envoie le mail (un bouton / un lien vers la page). Usage unique : écrit `sent`, la ligne sort du filtre Avis. Pas de libellé dans Toutes.
- **Ne pas demander d’avis** : écrit `skipped`, pas de mail. Usage unique.
- **Copier le lien** : ne change pas `review_ask`. Reste disponible après l’envoi du mail. Copie l’URL de la page (pas les trois URL sociales).

Toasts : même style que « Renvoyer l’e-mail ».

Le front n’invente pas l’horloge : l’API envoie `review_ask`, `can_ask_review`, `past_actions`, `review_url` (snake_case). Le JSX lit ces flags. `review_url` est présent dès que la résa est confirmée (token HMAC).

## Page publique

`GET /api/avis.php?b={id}&t={token}` — même schéma que `calendar.php` (HMAC `AUTH_SECRET`, booking id + e-mail).

Page HTML autonome (comme `confirm-booking.php`), habillage sombre Escape Occitanie. Pas de route React.

Contenu :

1. Merci d’avoir joué à `{salle}` le `{date}`.
2. Trois boutons : **Google** (`<avis-google>`), **Facebook**, **Instagram**.
3. Bloc bien visible : **envoyez cette page aux autres joueurs** de l’équipe. Actions : Partager (`navigator.share` si dispo) et Copier le lien.

Google = avis sur la fiche ; Facebook = avis / page ; Instagram = suivre / mentionner (pas d’avis Instagram).

Accès : token valide + réservation **confirmée**. Sinon page « Lien invalide » (même ton que confirm-booking). Annulée / pending / token faux → invalide. La page reste ouvrable après `sent` ou `skipped` (le lien déjà envoyé ne casse pas).

## Données

Colonne `bookings.review_ask` : `VARCHAR(16) NULL` (`sent`, `skipped`, ou `NULL`). Ajout dans `mt_ensure_bookings_schema` (`CREATE TABLE` + `ALTER` si absente).

`mt_booking_select_sql` / `mt_map_booking_rows` exposent `review_ask`, `can_ask_review`, `past_actions`, et `review_url` si `env` / secret dispo.

## API

Session manager obligatoire pour ask / skip, comme confirm / mail.

| Action | Requête |
|---|---|
| Envoyer le mail (lien) | `POST /api/bookings.php?id={id}&action=review-ask` |
| Ne pas demander | `POST /api/bookings.php?id={id}&action=review-skip` |

Les deux ne passent que si encore éligible. `UPDATE … WHERE id = ? AND review_ask IS NULL`. Concurrent : 409.

**Demander un avis** : envoyer le mail **puis** écrire `sent`. Échec d’envoi : `review_ask` reste `NULL`, HTTP 200 `{ booking, emailSent: false }` — second essai possible. Succès : `{ booking, emailSent: true }`.

**Ne pas demander** : `skipped`, pas de mail.

| Cas | HTTP |
|---|---|
| Pas de session | 401 |
| Introuvable | 404 |
| Annulée, pending, trop tôt, déjà décidé | 400 |

`GET /api/bookings.php?filtre=avis` : SQL `status = 'confirmed' AND review_ask IS NULL AND booking_date < aujourd’hui (Paris)`, pagination 10 / page.

Annuler / modifier / renvoyer l’e-mail **côté API** : inchangés. Confirmer un pending d’hier ou avant reste possible.

Helpers PHP testables : `past_actions` = `booking_date < mt_today_paris()`, `can_ask_review`, token avis (comme calendrier). Pas de table SQL supplémentaire.

Clients JS : `requestBookingReview(id)` / `skipBookingReview(id)` dans `booking.js`.

## Mail

Nouveau template `contribution/emails.xml` id **`client-avis`**.

- Sujet : `Un petit mot après votre partie — Escape Occitanie`
- MJML : même habillage que `client-attente` (fond sombre, logo, photo de salle).
- **Un seul bouton** : « Laisser un avis » → `{lien_avis}` (la page publique). Pas les trois liens sociaux dans le mail.
- Texte : remercier pour `{salle}` le `{date}` ; un clic pour la page ; **transmettre le lien aux autres joueurs**.

Filet `mail.php` si JSON absent : mêmes phrases en texte brut + URL. Envoi `mt_send_mail` HTML + texte, **sans** ICS.

`EMAIL_IDS` du compile inclut `client-avis`. `mt_booking_copy_vars` fournit `{lien_avis}`.

`<avis-google>` obligatoire dans `contact.xml` (compile, comme `facebook`). Seed :

`https://search.google.com/local/writereview?cid=6874570004777222413`

(CID de la fiche Maps `0x12b23bbf554c6b7d:0x5f6760ff0e4d410d`.) `{lien_facebook}` / `{lien_instagram}` : URLs existantes, utilisées **sur la page**, pas dans le mail.

## Tests

- PHP : même jour encore éditable, lendemain éligible (minuit Paris), filtre avis, skip, ask n’écrit `sent` que si le mail part, refus trop tôt / pending / cancelled / déjà décidé, token avis OK / KO, page refusée si pending.
- JS : `parseBookingFilter('avis')`, hash `#reservations?filtre=avis`.
- Compile : `client-avis` manquant → build KO ; fixture `contact.xml` avec `<avis-google>`.
- Mail copy : sujet, `{lien_avis}` rempli, un CTA, pas d’ICS, pas des trois URL sociales dans le mail.
- Navigateur : filtre Avis ; Demander / Copier / Ne pas demander ; après mail, Copier reste ; page publique : 3 boutons + partage aux autres joueurs ; Modifier / Renvoyer / Annuler absents dès le lendemain.

## Hors scope

- Cron / envoi automatique.
- Libellé d’état avis dans le tableau.
- Pastille de compteur sur le filtre Avis.
- Changer les URLs Facebook / Instagram (déjà dans `contact.xml`).
- Bloquer PATCH / DELETE / resend côté API pour les résas d’hier et avant.
- Éditeur Maître Thibault pour le MJML.
- WhatsApp (`wa.me`, bouton dédié, API Business).
