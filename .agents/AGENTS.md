# Règles de travail

## 1. Documentation & Incertitude (Obligatoire)
- Ne devine jamais. Si une information manque (nom de champ, schéma DB, version d'une librairie), arrête-toi et pose-moi la question.
- Avant d'utiliser une API Expo, React Native ou Node.js, vérifie sa version exacte dans `package.json`, puis interroge l'outil MCP `context7` (`resolve-library-id` -> `query-docs`). Ne te fie jamais à ta mémoire.
- Relis toujours un fichier avant de l'éditer, car j'ai pu le modifier entre-temps.

## 2. Gestion du contexte & Gros fichiers
- Si un fichier dépasse 300 lignes, lis-le par blocs (`offset` / `limit`) et traite-le bloc par bloc. N'assume jamais le contenu d'un fichier non lu en entier.
- Privilégie la réutilisation des composants existants dans `abstractions/` et `components/` avant d'en créer de nouveaux.

## 3. Standards Client (Expo / React Native) & Serveur (Node.js)
- **Client :** TypeScript strict (zéro `any`), navigation via Expo Router (`app/`), traductions via `locales/en` et `locales/fr` (aucun texte hardcodé dans l'UI).
- **Serveur (Node.js) :** Valide toutes les entrées (body, params, env) avec Zod. Ne renvoie jamais d'erreurs brutes ou de stack traces au client. Sépare les routes, la logique métier et l'accès aux données.

## 4. Bugs hors périmètre
- Si tu trouves un bug hors du sujet de la tâche en cours, ne le corrige pas. Ajoute une ligne dans `HANDOFF.md` (`fichier:ligne - description`) et continue.

## 5. Suivi, Lint & Mémoire persistante (Au fur et à mesure)
- **Lint :** Sur chaque fichier modifié, lance `npx eslint <fichier>` et corrige toutes les erreurs avant de passer au suivant.
- **Session (`HANDOFF.md`) :** APPEND uniquement (ne réécris jamais le fichier) ce qui est fait, ce qui reste, et les blocages éventuels. Si tu t'arrêtes avant la fin, laisse des instructions claires pour l'agent suivant.
- **Décisions (`docs/DECISIONS.md`) :** Après chaque choix technique, ajout de dépendance ou changement d'architecture, ajoute une entrée datée (`YYYY-MM-DD : Contexte / Décision / Fichiers impactés`) dans `docs/DECISIONS.md`.

## 6. Structure du projet (Racine relative `./`)
- `abstractions/` : Couche d'abstraction UI au-dessus de React Native (style / DRY)
- `app/` : Routes Expo Router (`(auth)`, `(modals)`, `(tabs)/[feed, home, inbox, profile]`)
- `assets/` : Polices, gifs, icônes, images
- `components/` : Composants métier réutilisables et `__tests__/`
- `constants/`, `contextes/`, `events/`, `functions/`, `hooks/`, `themes/`, `types/`
- `locales/` : Fichiers i18n (`en/`, `fr/`)
- `docs/` : Documentation projet (`DECISIONS.md`, architecture, schémas)
- `scripts/`, `svgs/`, `tests/`
-`../sync_api` : API (Node.js using Express)