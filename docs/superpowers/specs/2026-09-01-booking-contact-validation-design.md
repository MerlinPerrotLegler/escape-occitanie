# Validation nom / e-mail / téléphone — réservation

Date: 2026-09-01  
Statut: validé

## Problème

Le formulaire public de réservation (`BookingCalendar`) n’a que `required` HTML. Un nom d’un caractère, un e-mail minimal, ou un téléphone fantaisiste partent vers l’API. Le serveur refuse déjà nom vide, e-mail mal formé et téléphone vide, mais sans contrôle de format du numéro, et sans message sous le champ pendant la saisie.

## Objectif

Pendant la saisie (après le premier blur, puis à chaque frappe) et à l’envoi, valider nom, e-mail et téléphone. Nom et e-mail ont les mêmes règles navigateur / PHP. Le téléphone est validé par libphonenumber côté navigateur ; PHP ne fait qu’un filet de sécurité (pas de Composer sur Hostinger).

Approche retenue : **react-hook-form + zod + Form shadcn** (déjà dans le projet) pour le formulaire. Téléphone validé avec **`libphonenumber-js/max`** (`isValidPhoneNumber`). Pas de sélecteur de pays / drapeaux. Une seule nouvelle dépendance npm.

## Règles

Valeurs trimées avant contrôle. Messages en français, un par champ.

### Nom

- 2 à 120 caractères après trim.
- Lettres Unicode (accents compris), espaces, tirets, apostrophes (`'` et `’`).
- Au moins 2 lettres. `Jean-Luc`, `O’Brien`, `Marie Claire` OK. `A`, `--`, `123` refusés.
- Message : `Indiquez un nom (au moins 2 lettres).`

### E-mail

- Format e-mail (Zod `email` / PHP `FILTER_VALIDATE_EMAIL`).
- Longueur max 190 (colonne `guest_email`).
- Message : `E-mail invalide.`

### Téléphone

- 1 à 40 caractères (colonne `guest_phone`).
- Validité : `isValidPhoneNumber(value, 'FR')` depuis `libphonenumber-js/max` (métadonnées complètes, pas seulement la longueur).
- Pays par défaut **FR** : `06 12 34 56 78` et `0612345678` sont lus comme français. Un préfixe `+` (ex. `+44 20 7946 0958`) reste international.
- Exemples OK : `+33 6 12 34 56 78`, `0612345678`, `+44 20 7946 0958`. KO : `abc`, `1234`, `1111111111`.
- Message : `Numéro de téléphone invalide.`

Le nombre de joueurs (3–6) ne change pas.

## Front

Fichier : `apps/web/src/components/BookingCalendar.jsx`.

- Schéma Zod dans `apps/web/src/lib/bookingContact.js` (fonctions pures testables : `isGuestName`, `isGuestEmail`, `isGuestPhone` + schéma).
- `useForm` + `zodResolver`, `mode: 'onTouched'` : pas d’erreur tant que le champ n’a pas été quitté ; ensuite validation à chaque frappe ; submit valide tout.
- Chaque champ : `FormField` / `FormItem` / `FormControl` / `FormMessage` existants. Bordure `aria-invalid` déjà gérée par `FormControl`.
- Placeholder inchangé (`Nom`, `E-mail`, `Téléphone`). Pas de labels visibles en plus, pour garder le formulaire compact.
- Bouton « Réserver ce créneau » cliquable tant que la requête n’est pas en cours. Un submit invalide affiche les 3 messages sans appeler l’API.
- En cas d’erreur API (créneau pris, etc.), toast comme aujourd’hui.

Hors UI backoffice : l’édition inline de Maître Thibault reste un `Input` simple. Les règles PHP s’appliquent quand même si le manager enregistre.

## API

Extraire les contrôles nom / e-mail / téléphone dans `apps/web/public/api/lib/validate.php` (`mt_validate_guest_name` / `_email` / `_phone`), utilisés par `POST` et `PATCH` de `bookings.php`.

Le projet n’a pas Composer (PHP déposé tel quel sur Hostinger). PHP n’embarque pas Google libphonenumber : filet de sécurité uniquement (trim, max 40, caractères `+ chiffres espaces - . ()`, au moins 8 chiffres). La validité réelle du numéro est `libphonenumber-js` côté navigateur.

Réponses inchangées : `{ error: "…" }` HTTP 400. Messages PHP alignés sur le front pour nom et e-mail ; téléphone : `Numéro de téléphone invalide.`

Stockage : valeur trimée telle quelle (pas de normalisation E.164).

## Tests

- JS : `apps/web/tools/test-booking-contact.js` (même style que `test-short-date.js`) — cas OK / KO pour les 3 champs.
- PHP : assertions dans `apps/web/tools/test-api-lib.php` sur les helpers extraits.

Vérification navigateur avant de clôturer : formulaire réservation, blur + frappe + submit invalide (pas d’appel réseau) + submit valide.

## Hors scope

- Sélecteur de pays / drapeaux (`react-phone-number-input`).
- Composer / `giggsey/libphonenumber-for-php` côté Hostinger.
- Changement du flux créneau / joueurs / e-mails de confirmation.
- Validation live dans le backoffice manager.
