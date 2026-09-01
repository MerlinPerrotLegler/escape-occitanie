# Planning : créneaux sous la plage, reproduction

Date: 2026-09-01  
Statut: validé en conversation

## Problème

Sur `/maitre#planning`, les créneaux vivent dans un second bloc, plus bas, avec un sélecteur de date à part. Un clic sur une plage ne change que la date : les grilles ne sont pas là où le manager les cherche. Recopier une journée type (horaires + Ouvert / Indisponible / Fermé) vers d’autres jours se fait à la main.

## Objectif

1. Afficher les créneaux **sous la plage cliquée** (un panneau à la fois, `scrollIntoView` du bloc entier).
2. Laisser **créer** des plages comme aujourd’hui.
3. Consulter le mois via deux sélecteurs **mois en toutes lettres** + **année**.
4. **Reproduire** une plage ouverte vers d’autres jours d’un calendrier : horaires + états des deux salles, sans les réservations.

Approche retenue : accordion dans la liste du mois + dialogue calendrier. Le bloc « Créneaux » du bas (titre, date, pagination jour, grilles) **disparaît**.

## Mise en page

Deux sections, dans cet ordre.

### Ajouter une plage

Formulaire actuel : date (`ShortDateInput`), début, fin, bouton Ouvrir / Enregistrer, **DayPagination** à droite, Annuler en édition. Inchangé fonctionnellement. La date du formulaire **n’est pas** liée au mois affiché dans Planning.

### Planning

Sélecteurs **mois en toutes lettres** (locale `fr-FR`, ex. `Septembre`) + **année**. Même horizon que `yearSelectOptions` (année civile précédente → horizon 18 mois, plus l’année du mois affiché si besoin).

Liste des plages dont `period_date` tombe dans ce mois, tri date puis heure de début. Pas de `max-h-64` : la pagination **est** le mois. Mois vide : « Aucune plage ouverte ce mois-ci. »

Ligne : date courte + `début → fin`. Actions toujours visibles : **Modifier**, **Retirer**. **Reproduire** seulement sur la ligne **ouverte**.

### Accordion

- Une seule plage ouverte à la fois, identifiée par `period.id` (pas seulement la date).
- Clic sur la ligne (pas sur Modifier / Retirer / Reproduire) : ouvre, ou referme si déjà ouverte.
- Ouvrir une autre referme la précédente.
- Après ouverture : `scrollIntoView({ behavior: 'smooth', block: 'start' })` sur l’élément qui contient **la ligne et les grilles**.
- Panneau : composant `PeriodSlots` — Directeur puis Vaisseau, mêmes couleurs / libellés / cycle qu’aujourd’hui. Occupé : nom, clic → `#reservations/{id}`.

Après **Ajouter une plage**, passer le mois Planning sur le mois de la plage créée et l’ouvrir. Après **Modifier** qui change de mois, idem.

## Reproduire

Bouton sur la plage ouverte → `PeriodCopyDialog`.

Calendrier mois (grilles lundi–dimanche, même esprit que le calendrier public). Sélecteurs `MonthYearSelect` (partagés avec Planning). Clic jour : toggle multi-sélection. Le **jour source** est désactivé. Un jour qui a déjà au moins une plage est marqué visuellement (style distinct, toujours cliquable).

**Copier** inactif tant qu’aucun jour n’est sélectionné.

Copie : `start` / `end` de la source + flags Indisponible / Fermé des **deux** salles. Pas de réservations. Sur la cible, un créneau déjà **Occupé** reste occupé (le flag n’est pas posé sur cette unité).

Une plage par jour cible. Si le jour a déjà une ou plusieurs plages : ce sont des **conflits**.

- Sans `overwrite` : HTTP **409**, `{ error, dates: ['YYYY-MM-DD', ...] }`. Le dialogue demande une fois : « Écraser les N jours déjà ouverts ? ». Annuler : rien n’est écrit. Confirmer : même requête avec `overwrite: true`.
- Avec `overwrite` : sur chaque date cible, supprimer les plages existantes de ce jour, insérer **une** plage copie, remplacer les `closed_slots` de ce jour (les deux salles) par ceux de la source, hors unités occupées.

Tout-ou-rien : aucun conflit → toutes les dates sont écrites ; au moins un conflit et `overwrite` faux → **409**, aucune écriture. Après succès : fermer le dialogue, toast, recharger le mois affiché.

## Composants

| Fichier | Rôle |
|---|---|
| `apps/web/src/components/PeriodSlots.jsx` | Grilles 2 salles + cycle statuts |
| `apps/web/src/components/MonthYearSelect.jsx` | Mois toutes lettres + année |
| `apps/web/src/components/PeriodCopyDialog.jsx` | Calendrier multi-jours, Copier, confirm écrasement |
| `apps/web/src/lib/monthYear.js` | Bornes de mois, libellés `fr-FR`, options d’années — testable |
| `apps/web/src/pages/MaitreThibaultPage.jsx` | Orchestration, plus de bloc Créneaux du bas |

`MonthYearSelect` : deux `<select>`, mois `janvier`…`décembre` affichés avec capitale initiale. Pas de J-1 / J+1 sur Planning.

## API

`GET /api/periods.php?from=&to=` **avec session** : liste les plages dans l’intervalle, **y compris les dates passées**. Sans `from`/`to`, comportement actuel (`>= CURDATE()`) pour ne pas casser le reste.

`POST /api/periods.php?action=copy` (session) :

```json
{ "sourceId": 12, "dates": ["2027-09-10", "2027-09-17"], "overwrite": false }
```

Validation : `sourceId` existant, `dates` tableau non vide d’ISO uniques, pas la date source. 400 si invalide. 404 si source absente. 409 si conflits et `overwrite` faux. 200 `{ ok: true, copied: N }` sinon.

Logique métier extraite : `mt_copy_period(PDO, int $sourceId, array $dates, bool $overwrite): array` (succès ou throw / code conflit).

Création / modification / suppression de plage inchangées (`POST` sans action, `PATCH`, `DELETE`).

## Tests

- JS `apps/web/tools/test-month-year.js` : premier/dernier jour du mois, libellés FR, filtre des plages d’un mois.
- PHP dans `apps/web/tools/test-slot-duration.php` (ou fichier dédié) : copie horaires + flags deux salles ; résa cible intacte et créneau toujours occupé ; 409 sans overwrite (aucune écriture) ; overwrite = une plage par jour, flags remplacés.

Vérification navigateur : ouvrir une plage → grilles dessous + scroll ; refermer ; Reproduire 2 jours vides ; Reproduire un jour déjà ouvert → confirm → écrasement.

## Hors scope

- Copier des réservations.
- Tableau public `AvailabilityTimeline`.
- Plusieurs plages distinctes conservées sur un même jour cible après reproduction (overwrite = une seule plage copie).
- Pagination autre qu’au mois (7 plages, scroll interne).
