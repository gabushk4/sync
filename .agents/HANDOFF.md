# HANDOFF — Review + correction docs/ vs code (branche `gab`)

## Fait
- Lu les 14 fichiers de `docs/` en entier.
- Vérifié chaque affirmation contre le code et corrigé les `.md` :
  - `01-contextes.md` : liste complète (20 fichiers), ordre providers réel,
    `EventDraftProvider` dans `AppLoader`, 2 FAB providers distincts.
  - `02-composants.md` : inchangé (les 35 fichiers listés existent ; les
    "manquants" supposés venaient d'un listing périmé, infirmés par `ls`).
  - `03-fonctions.md` : signatures réelles (`AutoRefresh` classe,
    `ChooseImage(onChange)`, `asyncStorageSettingsRepository`, `getToken/
    setToken`, `getDeviceTimezone/getAvailableTimezones`, `getNow.js` vide,
    format serveur `"yyyy-MM-dd HH:mm:ss"`).
  - `04-routes.md` : routes manquantes ajoutées, `(modals)`/`scanQR` hors
    guards (conforme au `_layout.tsx` actuel).
  - `05-types.md` : exemples réels (`Event`, `Participant`, `FPType`,
    `UrlDescriptor`, `AppSettings.theme: number`, `listener.ts` vide).
  - `06-hooks.md` : vraies APIs (`useNavFab(config)`, `useActionFab`,
    `useFriendList(type)`, `useEmailConfirmation` vide) ; `useSettings`/
    `useFont` identifiés comme contextes.
  - `07-config.md` : couleurs HSL dynamiques, `Radius.xl = 20`, vraies
    valeurs Reanimated, endpoints observés (dont `PATCH`, pas de
    `DELETE /evenements/{id}` observé).
  - `08-locales.md` : chemins réels (`i18n.js`, `locales/`), 14 namespaces.
  - `09-logique-metier.md` : snippets alignés (validation titre, 201 lâche,
    fallbacks `DateTime.now`, étape ms→`DateTime`, endpoints réels, 304).
  - `10-authentification.md` : flux réels (`/membres/inscription` → login,
    `/membres/connexion` → `signIn`), vrai type `AccessTokenContextType`,
    refresh via `POST /token`.
  - `11-specificites-expo.md` : versions installées au lieu de "v3+",
    exemple typed-routes réel.
  - `settings.md` : réécrit (AsyncStorage vs SecureStore, `theme: number`,
    vraie `SettingRow`, vrais settings).
  - `README.md` : liens vers les 12 docs.
- Grep final : aucune affirmation fausse restante.
- Aucune modification de code applicatif (docs uniquement).

## Points marqués "(contenu non vérifié)" dans les docs
- `01` : `contexteListeOptions.js`, `contexteListesVisibles.js`, `contexteLogs.js`
- `04` : `profile/edit.tsx`, `(modals)/dataRenderer.tsx`
- Descriptions une par une des 35 composants de `02` (existence confirmée).

## Reste possible
- Lire `login.tsx`/`register.tsx` en entier (seuls des extraits ciblés ont
  été vérifiés) ; relire les 35 composants pour valider chaque description.
- Corriger l'écart `DEFAULT_SETTINGS.theme (260)` vs `DEFAULT_HUE (274)` ?
  Décision au user (hors périmètre docs).

## Bugs hors sujet
- Aucun trouvé dans ce périmètre.

---

# HANDOFF — CI GitHub Actions (10/10/2026)

## Fait
- Node figé sur 20 (`node -v` local : v20.20.1, npm 10.8.2 ; pas de
  `.nvmrc`/`engines` dans le projet).
- Deps ajoutées via `npx expo install` (versions compatibles SDK 57,
  doc officielle https://docs.expo.dev/develop/unit-testing/ et
  https://docs.expo.dev/guides/using-eslint/) :
  `eslint ^9.39.5`, `eslint-config-expo ~57.0.2`,
  `jest ~29.7.0`, `jest-expo ~57.0.5`, `@types/jest 29.5.14`.
- `eslint.config.js` (nouveau) : généré par `npx expo lint` (flat config).
- `package.json:10` : scripts `lint` (expo lint), `typecheck` (tsc --noEmit),
  `test` (jest --ci --runInBand) + bloc `jest` (preset jest-expo,
  transformIgnorePatterns doc Expo).
- `tests/availability.test.js` (nouveau) : les 3 cas de
  `tests/common_free_slot_dst.js` convertis en Jest (3/3 passent).
- `.github/workflows/ci.yml` (nouveau) : 3 jobs (lint, typecheck, test),
  `on: [push, pull_request]`, Node 20 + cache npm, `npm ci`.
- `.gitignore` : ajout de `coverage/`.
- Vérifié : YAML parsé OK, `npx jest tests/availability.test.js` 3/3 vert.

## Baseline CI = rouge (dette préexistante, non corrigée, hors périmètre)
- Lint : 100 erreurs + 197 warnings (`npm run lint`, exit 2).
  Top erreurs : `react-hooks/immutability` (52), `import/no-unresolved`
  (17), `react-hooks/rules-of-hooks` (16), `react-hooks/set-state-in-effect`
  (15). Top warnings : `no-unused-vars` (137+18), `exhaustive-deps` (47).
  Config `eslint.config.js` : bloc `globals` Jest ajouté pour les fichiers
  de test (sinon `describe/test/expect` = `no-undef`).

## CI phase 2 (10/10/2026, demande user : lint-sur-diff + Tickets.md)
- `.github/workflows/ci.yml` : job `lint` ne linte que les fichiers JS/TS
  modifiés de la PR/push (`git diff`, bloquant) ; `typecheck` en
  `continue-on-error` (informatif) ; job `test` avec quarantaine
  `--testPathIgnorePatterns "StyledText-test"` (vérifié vert : 1 suite, 3 tests).
- `Tickets.md` : T1-T12 ordonnés par priorité (T1 débloque la suite),
  copiables dans Discord, avec fichiers,
  lignes, règles et critères d'acceptation (données vérifiées eslint/tsc).
- ⚠️ NON FAIT PAR L'AGENT : `components/StyledText.tsx` et
  `components/Themed.tsx` supprimés du disque + suppression stagée,
  constaté après la session. User (10/10/2026) : suppression assumée.
  Impact vérifié : `app/modal.tsx:6`, `components/EditScreenInfo.tsx:5-6`
  importent les modules supprimés (3 erreurs tsc TS2307) → voir T2.
- Typecheck : 9 erreurs TS (`npx tsc --noEmit`, exit 2, recalculé après suppression assumée T1).
- Tests : 3/4 verts ; échec préexistant voir "Bugs hors sujet CI" plus bas.

## Reste
- Tickets T1-T12 dans `Tickets.md` (T1+T2 débloquent les jobs, T5 re-bloque
  le typecheck, T12 optionnel). Stratégie : T6 avant T7-T11 si parallèle.
- Conseil : exiger les 3 checks comme "required" dans les branch rules
  GitHub une fois la baseline reverdie.

## Bugs hors sujet CI (non corrigés, à reprendre)
- `components/__tests__/StyledText-test.js:9` : `toJSON()` rend `null`,
  aucun snapshot commité, `react-test-renderer` déprécié sous React 19.
- `abstractions/touchableOpacityAbs.tsx:23` : `fonts` introuvable + props
  JSX invalides (remonté par `tsc`, préexistant).
- `components/Themed.tsx:24,29` : indexation `ColorSchemeName`
  (`unspecified`) non couverte — obsolète, fichier supprimé (suppression
  assumée par le user, voir T1).
- `svgs/*.tsx` : prop `xmlns` rejetée par les types `react-native-svg`
  (remonté par `tsc`, préexistant).
- Note : modif `app.json` (`owner: alkemist`) déjà présente dans le
  working tree avant cette session, non touchée.

---

# HANDOFF — Exécution agent T6, T1, T2, T4 (10/10/2026)

## Fait (vérifié par relecture des diffs + runs d'exécution)
- 4 branches locales (push KO : pas de credentials GitHub dans cet env ;
  au user de pousser) : `fix/T6-dead-code` (06970c2, 54 fichiers, +56/−257),
  `fix/T1-styledtext-test` (7237b38), `fix/T2-broken-imports` (63a5a37),
  `fix/T4-svg-xmlns` (6d90c4a).
- T1 : test supprimé + quarantaine retirée ; `jest --ci` vert SANS flag
  (1 suite, 3/3 — vérifié en worktree dédié).
- T2 : `modal.tsx`, `EditScreenInfo.tsx` migrés vers RN `Text/View` +
  `useColorScheme` (light/dark recopié de l'ancien Themed) ; eslint 0 erreur
  sur les 2 fichiers ; 3 TS2307 supprimés, rien ajouté (vérifié : reste 13
  erreurs, toutes dans des fichiers non touchés). Point review : `useColorScheme`
  vient de `react-native` (pas le wrapper `./useColorScheme`) — OK pour ces
  écrans démo, à confirmer en review.
- T4 : `xmlns` (+ `xmlSpace` sur appIcon, aussi rejeté) retirés, diffs lus OK.
- T6 : 154 warnings unused → 0 (diff stat relu ; insertions = lignes
  d'import modifiées, pas de nouveau code).

## Baselines recalculées sur main (après PR #6 FAB-fix + `npm ci` frais)
- tsc : 13 erreurs (9 anciennes + 4 retombées PR #6 : `FabConfig.visible`
  ×2, `useFabActions` args ×2). Faux positif écarté : `expo-audio`
  "introuvable" venait d'un `node_modules` périmé local, résolu par `npm ci`.
- eslint brut : 138 erreurs / 285 warnings (dont 6 erreurs retombées PR #6 :
  `voiceRecorderButton` purity ×2 + refs ×3, `useActionFAB` refs ×1).
- → Nouveau ticket T13 ajouté à `Tickets.md` (retombées PR #6, bloque T5) ;
  T5 dépend désormais de T2, T3, T4, T13.

## Reste / reprise
- Pousser : `for b in fix/T6-dead-code fix/T1-styledtext-test fix/T2-broken-imports fix/T4-svg-xmlns; do git push -u origin $b; done`
  (depuis un env avec credentials), ouvrir 1 PR par branche, merger dans
  l'ordre T6 → T1 → T2 → T4.
- Tickets restants : T3, T5 (après T2+T3+T4+T13), T7-T12, T13 (neuf).
- Incident suivi : un sous-agent avait écrasé ce fichier par son rapport
  de 30 lignes ; contenu restauré depuis l'historique (aucune perte) —
  consigne : les agents APPENDENT au HANDOFF, ne le réécrivent jamais.

---

# HANDOFF — Vérification indépendante + PR descriptions (11/10/2026)
## Vérifié (worktrees /tmp, node_modules symlinké, sans toucher au working tree)
- Bases OK : les 4 branches `fix/*` partent toutes de `3df9b0a` (main = PR #6).
- T1 (`7237b38`) : `jest --ci` vert SANS flag (1 suite, 3/3) ; quarantaine
  retirée de `ci.yml:74`. tsc inchangé (14, attendu).
- T2 (`63a5a37`) : `eslint` 0 problème sur `app/modal.tsx` +
  `components/EditScreenInfo.tsx` ; tsc 14 → 11 (3 TS2307 supprimés, 0 ajouté).
- T4 (`6d90c4a`) : tsc 14 → 11 (3 TS2322 xmlns supprimés, 0 ajouté).
  `xmlSpace` aussi retiré sur `appIcon` (rejeté lui aussi, OK).
- T6 (`06970c2`, 54 fichiers) : `no-unused-vars` 154 → 0 (136 TS + 18 base) ;
  bonus `import/no-unresolved` 17 → 11 (imports incassables mais inutilisés
  supprimés) ; aucune nouvelle erreur/warning ; tsc inchangé (14).
  Spot-check `profile/index.tsx` : styles animés supprimés (`flatListWidgetsAnime`,
  `banniereImageAnime`, `photoProfilAnime`, `cameraStyle`) = définitions mortes
  (0 usage JSX sur main comme sur T6) ; `[, setFpSource]` correct (setter utilisé
  l.250-271).
## Écarts vs HANDOFF précédent (à corriger, non bloquants)
- Baseline tsc réelle = **14** erreurs, pas 13 : `components/ExternalLink.tsx:13`
  (TS2578 `Unused '@ts-expect-error'`, préexistant depuis `bef6624`, SDK plus
  strict) oublié du décompte. Reste après T2+T4 combinés = 8 (3 T3 + 4 T13 + 1
  ExternalLink) — prévoir ticket (T3-bis ou ajout à T13).
- Baseline eslint réelle = 138 erreurs / **284** warnings (pas 285).
- "Reste 13 erreurs" après T2 : en fait 11 sur la branche T2 seule (14 − 3).
## Non fait
- Push/PR GitHub : impossible depuis cet env (`gh` absent, aucun credential,
  `git ls-remote` échoue). Branches `fix/*` locales sans upstream.
  Commande : `for b in fix/T6-dead-code fix/T1-styledtext-test fix/T2-broken-imports fix/T4-svg-xmlns; do git push -u origin $b; done` puis ouvrir 4 PR
  (descriptions fournies en chat le 11/10/2026, ordre de merge T6 → T1 → T2 → T4).

---

# HANDOFF — Philip (branche `philip-dev-s1`, 10-11/10/2026) : calendrier (US5), conflits / invitations (US8), rectifications d'affichage

Branche : `philip-dev-s1` (à jour avec `origin/main` au début du travail, commit `3df9b0a`).

## Tâche en cours : changements au calendrier mensuel (vue calendrier de l'accueil)

Comportement demandé par Philip (confirmé le 2026-10-10) — code écrit, `tsc` sans
erreur dans les fichiers touchés, **pas encore testé dans l'app** (voir bundle plus bas) :
- [x] Flèche retour en haut à gauche du calendrier → timeline du jour sélectionné
      (ou du jour affiché avant d'ouvrir le calendrier si rien n'est sélectionné ;
      début de la plage si une plage est sélectionnée). `retourCalendrier` (home).
- [x] Le bouton « + » reste visible dans le calendrier (`visible: true`, déjà fait par Gabriel).
- [x] Tap sur un jour : le sélectionne et affiche ses événements dans une liste
      (ScrollView) en bas du calendrier ; ne retourne plus à la timeline.
- [x] Hold + glisser : au relâchement, la plage reste sélectionnée (n'ouvre plus la
      création). Le « + » crée l'événement sur le jour (heure suivante) / la plage
      (jours entiers) sélectionnée (`paramsCreation` dans home).
- [x] Tap sur un jour quand une plage existe : enlève la plage, sélectionne ce jour.
- [x] Tap sur un événement de la liste : ouvre ses détails (même navigation que ListItem).
- [x] Le tap dans le vide ne ferme plus le calendrier (remplacé par la flèche).

Fichiers touchés : `components/calendarMonthView.tsx`, `app/(tabs)/home/index.tsx`,
`hooks/useNavFAB.tsx`, `locales/{fr,en}/calendar.json`, `components/listItem.tsx`,
nouveau `functions/ouvrirDetailsEvenement.ts`.

### Correction (2026-10-10) : événements du jour sélectionné absents
Cause : le calendrier partageait `userEvents` (et son AutoRefresh) avec la timeline.
Au retour d'un autre écran (ex. détails d'un événement ouverts depuis la liste),
l'effet de focus de l'accueil recrée le rafraîchissement **du jour courant**, ce qui
remplaçait les événements du mois → le 4 octobre paraissait vide jusqu'au changement
de mois. Vérifié avec l'API (le mois d'octobre renvoie bien les 2 événements du 4).
Correction : le calendrier a sa propre liste `evenementsMois` et son propre
AutoRefresh (effet de focus dépendant de `vueCalendrier` / `moisCalendrier`), recréé
au retour d'un écran ; la timeline n'est plus basculée jour ↔ mois.
`formaterEvenementsMembre` (pure) est partagée par les deux.

### Calendrier = page séparée (2026-10-10)
- Nouvelle page `app/(tabs)/home/calendrier.tsx` (Stack de l'accueil, en-tête natif
  « Calendrier » + flèche native, choix de Philip). Elle contient la sélection (jour /
  plage), son propre AutoRefresh du mois et son « + » (`useNavFab('calendrier', …)`).
  Ouverte par le bouton date (icône calendrier) de l'accueil, avec `jour` en paramètre.
- Retour (flèche, glisser iOS, bouton Android) : la page enregistre le jour sélectionné
  dans `events/calendrierEvents.ts` ; l'effet de focus de l'accueil le consomme et affiche
  la timeline sur ce jour (sinon aujourd'hui, comme avant).
- La flèche ← ajoutée dans `CalendarMonthView` a été retirée (remplacée par l'en-tête).
- Fonctions partagées déplacées dans `functions/evenementsMembre.ts` : `paramsPlage`,
  `paramsJour`, `paramsMois`, `LIMITE_MOIS`, `formaterEvenementsMembre`.
- L'accueil ne contient plus aucun état du calendrier (`vueCalendrier`, etc.).
- `pathname: '/(tabs)/home/calendrier' as any` dans l'accueil : les types de routes
  d'expo-router se régénèrent au prochain `npx expo start`, le `as any` pourra partir.

### Optimisations / réutilisation (2026-10-10)
- Ouverture du calendrier (« sleep » ressenti) : pas de pause dans le code, mais la
  `FlatList` des mois rendait 21 pages (~900 cases) → `windowSize={3}`,
  `initialNumToRender={1}`, `maxToRenderPerBatch={1}` ; et la grille attendait la mesure
  `onLayout` → largeur estimée depuis la fenêtre au premier rendu (recalée ensuite).
- Points des jours : `Set` + `.has` au lieu d'un tableau parcouru pour chaque case.
- Navigation vers les détails partagée (`ouvrirDetailsEvenement`) par la timeline
  (ListItem) et la liste du calendrier.

### Hold + glisser, boîte animée, événements perdus après un swipe (2026-10-10)
- Événement du 4 oct. disparu après oct → nov → oct : le mois était synchronisé sur
  `onScrollEndDrag` (offset au lâcher du doigt, pas la page finale) → un swipe court
  changeait le mois affiché sans prévenir le parent. Maintenant `onMomentumScrollEnd`
  (+ `onScrollEndDrag` seulement si déjà aligné), et `onChangeMonth` reçoit le mois
  absolu (plus de cumul ±1). Garde `actif` dans `calendrier.tsx` contre une réponse
  tardive d'un ancien mois (`destroy()` n'annule pas la requête en cours).
- Hold : le PanResponder + `measureInWindow` (mesuré pendant l'animation d'entrée de la
  page) remplacé par un `Gesture.Pan().activateAfterLongPress(300)` (RNGH), coordonnées
  relatives à la grille, haptique au début et à chaque jour.
- Plage affichée par une boîte (un segment animé `SegmentPlage` par rangée de semaine,
  `withSpring`) qui grandit avec le doigt et reste après le relâchement.
- Pas encore testé sur appareil.

### Liste par jour + conflit multi-évènements (2026-10-10)
- Liste sous le calendrier : une section par jour (date, compteur, puis ses évènements ;
  un évènement de plusieurs jours apparaît sous chaque jour avec « Jour n sur N »).
  Plus de titre « date – date » pour une plage. Cartes : colonne heures, titre,
  description, icônes récurrence / privé.
- **API (`sync_api`, branche `philip_dev`)** : `verifierDisponibilite` collecte TOUS les
  chevauchements ; `retourConflit` renvoie `evenements` (tous, triés) + `evenement` (le
  1er, compatibilité). `trouverChevauchement` renvoie maintenant un tableau. Les
  exceptions sont aussi appliquées pour un nouvel évènement récurrent. → redémarrer /
  redéployer l'API. (`routes/disponibilites.js` appelle `trouverChevauchement` avec une
  autre signature et du `knex` : déjà cassé avant, non touché.)
- Modale `conflitEvenement` : liste à cocher de tous les évènements en conflit (tous
  cochés), « Retirer n évènements et créer », « Modifier mon horaire », « Ne pas créer ».
  Si des conflits restent après la création, la liste est remplacée par ceux-ci.

### Pas d'évènement dans le passé (2026-10-10)
- `FabConfig.bloque` (message) : le FAB affiche ce message en toast au lieu de naviguer.
  Utilisé par le calendrier (jour / plage qui commence avant aujourd'hui) et l'accueil
  (jour affiché avant aujourd'hui).
- `create.tsx` : le minimum n'est plus jamais dans le passé (une plage qui commence plus
  tôt aujourd'hui démarre à maintenant) ; validation à l'envoi (`create.pastStart`).
- API : middleware `refuserDebutPasse` sur POST /evenements (400, marge 5 min). Vérifié en
  local : passé → 400, futur → 201 (évènements de test supprimés).

### Toasts bloqués + titre requis (2026-10-10)
- `ToastAbs` : la file attendait le `onHide` du toast affiché ; un toast montré par le
  `<Toast/>` de `(modals)/_layout` (modale de conflit) fermé avant la fin ne l'appelait
  jamais → tous les toasts suivants restaient en file (ex. « doit avoir un nom » après
  une création multi-jours). Ajout d'un minuteur de secours, et un toast persistant
  (`autoHide: false`) est remplacé au lieu de bloquer la file.
- `toastErreur` : `minHeight` au lieu d'une hauteur fixe (le texte long débordait).
- Titre vide vérifié avant tout dans `create.tsx` (`create.titleRequired`) et dans l'API
  (`exigerTitre`, avant `verifierDisponibilite`).

### Revue calendrier + conflit (2026-10-10)
Corrigé : événements gardés par mois (`evenementsParMois`) et grille complète chargée
(`paramsMois` couvre les semaines de bord) ; memo `semainesActuel` sur l'index ; points
et liste avec la même règle (fin à minuit) ; conflit : arrêt si un retrait échoue ;
`dismissTo('/(tabs)/home')` au lieu de `replace` (créait un 2e accueil par-dessus le
calendrier) ; titre en double retiré de la route POST (API).
Non corrigé (noté) :
- Conflit sur une occurrence modifiée (`type: 'exception'`) : `retirerExistant` fait un
  DELETE /evenements/<id> avec l'id de l'exception (probablement 404).
- API `verifierDisponibilite` : pour un NOUVEL évènement récurrent, la fenêtre ne couvre
  que le jour de la 1re occurrence → les occurrences suivantes ne sont pas vérifiées.
- `home/index.tsx` : code mort déjà présent sur `main` (`getEventDateRangeParams`,
  `chargerEvenementsEvent`, `currentTime`, `chargementEchec`, `afficherRetour`, …).

### Revue finale + DRY + commentaires (2026-10-11)
- Nouvelles fonctions partagées : `functions/jourCreation.ts` (`debutCreationPourJour`,
  `estJourPasse` — accueil + calendrier), `dernierInstant` dans `evenementsMembre.ts`
  (points / liste / libellés du calendrier), `conflitsDeLaReponse` dans `types/conflit.ts`
  (création + modale de conflit).
- Retirés : `getEventDateRangeParams` (mort, doublon de `paramsJour`) et le paramètre
  `existant` de la modale de conflit (plus envoyé).
- Commentaires JSDoc avec `@author Philip — user story 5` (calendrier),
  `— user story 8` (conflit, app + API) et `— rectification for a more conventional
  display` (accueil, toasts, FAB, dispo communes, validations, API titre / date passée).
- Vérifié : `tsc` (aucune nouvelle erreur), API locale (201 / 400 titre / 400 passé /
  409 avec `evenements`). Jest non lancé : preset `jest-expo` absent de node_modules.

### « Modifier mon horaire » → calendrier tel qu'avant le « + » (2026-10-11)
- 4 essais ratés en naviguant depuis la route `(modals)/conflitEvenement` (autre pile
  que la création) : deux back(), fermeture au focus, dismissTo (empilait un nouveau
  calendrier), navigation de la création via un registre.
- Solution finale : l'écran de conflit n'est plus une route. C'est le composant
  `components/conflitEvenement.tsx`, affiché par `create.tsx` dans un `Modal` RN
  transparent (avec son propre `<Toast/>`). Il appelle `onSortie('formulaire' | 'retour'
  | 'accueil')` ; `create.tsx` le ferme puis fait `navigation.goBack()` (retour au
  calendrier tel quel, ou à la timeline) ou `dispatch({ type: 'POP_TO_TOP' })`.
  Supprimés : `app/(modals)/conflitEvenement.tsx`, `events/conflitEvents.ts`.
- À tester sur appareil.

### Vue horaire mise à jour dès la sélection dans le calendrier (2026-10-11)
- `calendrierEvents` est devenu un émetteur (`definirJour` / `abonner`) : chaque
  sélection (jour, ou 1er jour d'une plage) est appliquée tout de suite par l'accueil
  (`appliquerJourCalendrier`), encore caché sous le calendrier, avec préchargement du
  jour choisi (`prechargerJours(jour, true)`). Au retour, la timeline est déjà sur ce
  jour (avant : changement visible pendant la transition). L'ancien `consommerJour`
  est retiré ; le focus de l'accueil garde simplement le jour affiché.

### « Jour entier » dans la création (2026-10-11)
- `datetimeSelecteurs.tsx` : l'effet sur `isAllDay` (qui tournait aussi au montage)
  remplacé par `basculerJourEntier` ; activé tout seul pour des jours entiers pré-remplis
  (plage du calendrier) ; changement de date en jour entier garde minuit → 23:59:59 ;
  fin conservée au changement de date de début (elle retombait à minuit) ; Android :
  sélecteur de date de fin séparé (les deux dialogues s'ouvraient) et refermé.
- `estJourneeEntiere` (jourCreation.ts) ; `create.tsx` accepte un jour entier commençant
  aujourd'hui et garde la plage telle quelle.
- API `refuserDebutPasse` : refuse si la fin est passée ou le début > 25 h dans le passé
  (un jour entier d'aujourd'hui commence à minuit local). Vérifié en local (201 / 400).

### Onglet « sync » depuis le calendrier (2026-10-11)
- `app/(tabs)/_layout.tsx` : l'onglet home avait `href: "/(tabs)/home"` → bouton-lien
  qui ouvrait une NOUVELLE timeline (sur aujourd'hui) par-dessus le calendrier. `href`
  retiré pour home + écouteur `tabPress` : si la pile home a plus d'un écran,
  `POP_TO_TOP` sur cette pile → timeline existante, déjà sur la date du calendrier.
- Corrigé aussi : « Jour entier » ne basculait jamais — `SwitchAbs` ne transmet que
  `onValueChange` (le `onChange` passé était ignoré).

### Invitations : conflits à l'acceptation, revue des horaires, page de décision (2026-10-11)
- **API (`sync_api`)** :
  - `verifierDisponibilite.js` : logique extraite dans `trouverConflits(...)` (partagée) ;
    seuls les évènements créés par le membre ou ACCEPTÉS comptent (plus les invitations
    en attente / refusées).
  - `creerEvenement.js` (nouveau) : insertion + créateur + invitations (POST /evenements).
    `invite.js` : heures en `HH:mm`.
  - `PATCH /evenements/invitations/:id` (acceptee) : vérifie l'horaire de l'invité → 409.
  - `POST /evenements/:id/participants` : `exigerParticipantAccepte` (403 sinon).
  - `GET /evenements/invitations/:id/horaires?debut&fin` (réservé à l'invité) →
    `{ evenement, leader, invites, moi }` + évènement invité avec `statut_invitation`.
  - Testé en local : 409 à l'acceptation avec conflit, 200 sans conflit, 403
    non-participant, horaires 200 (invité) / 404 (autre). Données de test supprimées.
- **App** :
  - `components/conflitEvenement.tsx` : props `evenement`, `confirmer`, `mode`
    ('creation' | 'invitation').
  - `hooks/useDecisionInvitation.tsx` : accepter (409 → fenêtre de conflit : retirer et
    accepter / modifier mon horaire → revue) et refuser ; utilisé par le fil
    (`notificationItem.tsx`) et la page de décision.
  - `app/(tabs)/home/revueInvitation.tsx` : organisateur (⭐) / invités / moi, évènement
    invité vert / jaune / rouge selon le statut, seul celui de l'organisateur est
    touchable → page de décision (`details/[eventId]` avec `invitation` : lecture seule,
    `components/panneauDecisionInvitation.tsx` : participants dépliables + Accepter /
    Refuser).
  - `Event.couleur` / `Event.cliquable`, `ListItem onPress`, `EventsList
    onPressEvenement` / `defilerMaintenant`.
- **Contre-proposition retirée à la demande de Philip** (route, migration annulée en local
  avec `migrate:down` puis supprimée, bouton, paramètres de création, statut, textes).
- Pas encore testé sur appareil.

### Revue d'intégrité invitations (2026-10-11)
- DRY : `functions/couleurStatutInvitation.ts` (revue + panneau), `bornesLocales` dans
  `types/invitation.ts`, `useDecisionInvitation` : accepter / refuser → `repondre(statut)`,
  `ouvrirDecisionInvitation` partagé (fil + revue). Confirmation « Attention » avant de
  retirer des conflits. JSDoc `@author Philip — user story 8` partout.
- Retestés en local : 409 / 200 à l'acceptation, 403 non-participant, horaires 200 / 404,
  création 201.

### Chargements / spinners (2026-10-11)
- `Spinner` commun (user story 12) au lieu d'`ActivityIndicator` dans mes écrans (accueil,
  revue, panneau de décision, conflit).
- Plus de spinner infini en cas d'erreur : revue (bouton « réessayer »), participants du
  panneau, mois du calendrier, rangée du membre sur l'accueil.
- Réponse à une invitation : spinner sur le bouton envoyé, boutons désactivés, plus de
  double envoi (fil ✓/✗ et page de décision ; le refus du fil passe aussi par le hook).
- Création : verrou `envoiEnCoursRef` (un double appui créait l'évènement 2 fois) +
  spinner pendant l'envoi.
- Calendrier : spinner au lieu de « Aucun évènement » pendant le chargement du mois.

### Invitations envoyées seulement à la création (2026-10-11)
- App : déjà le cas (participants gardés en local pendant la création, envoyés avec
  `POST /evenements`). Sécurisé : `participantsListe.tsx` ne passe `inviterUrl` que pour
  un évènement existant ; `eventListAmi.tsx` ignore un paramètre « undefined ».
- API : les pushs d'invitation partaient AVANT le commit. `envoyerNotification(...,
  { pushsDifferes })` les met en file ; `envoyerPushsDifferes(pool, pushs)` les envoie
  après le commit (POST /evenements et POST /:id/participants).
- Testé en local : création en conflit → 409 et 0 invitation ; création libre → 201,
  1 invitation + notification.

### Revue : amis vs non-amis (2026-10-11)
- API horaires : `resoudreAmitie` → chaque personne a `ami` ; évènements d'un ami comme
  les rangées d'amis (titre caché seulement si privé), d'un non-ami `masque: true` sans
  titre ni description.
- App (`revueInvitation.tsx`) : `masque` → bloc gris (`colors.muted`) libellé « Privé ».
- Testé en local pour un ami (titre visible). Cas non-ami pas testé (pas de 3e compte).

### Revue : dispo communes, vert foncé, mon évènement touchable (2026-10-11)
- Rangées d'amis : `getCommonFreeSlots(mes occupations, les siennes, jour)` (une
  invitation non acceptée ne compte pas comme occupée).
- Évènement invité de l'organisateur : `assombrir(colors.success)` (nouveau, dans
  `couleurStatutInvitation.ts`, pour les couleurs `hsl(...)` de la palette).
- L'évènement invité dans MA rangée est aussi touchable → page de décision.

### Mot de passe oublié + journal des erreurs (2026-10-11)
- App : le bouton « mot de passe oublié » de `login.tsx` ne faisait qu'un log.
  `components/motDePasseOublie.tsx`, affiché dans `ModalBase` par la route
  `app/(auth)/mdpOublie.tsx` (transparentModal dans (auth) : les routes (modals) exigent
  d'être connecté ; 2026-10-13, avant c'était un Modal RN) → `POST /recuperation/demande` (API user story 14 déjà prête), spinner,
  erreur affichée dans la fenêtre, toast de succès. Textes `forgot.*` dans `auth.json`.
  Testé : courriel inconnu → 400 « Adresse courriel introuvable ». Envoi réel pas testé
  (pour ne pas envoyer de courriel).
- API : `logErreurRequete(req, res, titre, err)` ajouté à `logErreur.js` (entrée avec la
  trace + marque la requête pour éviter le doublon de `journaliserReponses5xx`). Utilisé
  dans les catch de : création, vérification participant, ajout de participants,
  réponse à une invitation, horaires d'invitation, `verifierDisponibilite`.
- À signaler (US 14, pas modifié) : `/recuperation/demande` dit si un courriel existe ou
  non (énumération de comptes).

## Bugs trouvés hors sujet (non corrigés)
- `hooks/useNavFAB.tsx` : `configRef = useRef(config)` n'est jamais mis à jour, donc le
  FAB garde les `params` du premier rendu. **Corrigé quand même** : nécessaire pour que
  le « + » reçoive le jour / la plage sélectionnée (dans le sujet de la tâche).
- `sync_api/src/functions/envoyerEmail.js` : `throw EmailError` (lance la classe, pas
  une instance) au lieu de `throw new EmailError(...)`.
- `sync_api/src/routes/evenements.js` (route DELETE d'une exception) : `DELETE FROM
  exceptions` alors que la table s'appelle `evenements_exceptions`.

- **CORRIGÉ (accord de Philip, 2026-10-10)** — bloquant, déjà présent sur `origin/main` :
  l'app ne compilait plus. `app/modal.tsx` (écran de démo du modèle Expo, ouvert nulle
  part) → `components/EditScreenInfo.tsx` importait `./Themed` et `./StyledText`,
  supprimés par Gabriel dans `c90aa48`. Les deux fichiers ont été retirés (`git rm`) ;
  le bundle Android et iOS compile de nouveau. À signaler à Gabriel : `main` est cassé.
- **Déjà présent sur `origin/main`** (FAB-fix de Gabriel, nouvelles signatures
  `useNavFab(owner, config)` / `useActionFab(owner, { action, config })`) :
  - `app/(tabs)/profile/edit.tsx:62` et `app/(tabs)/home/edit/[event].tsx:161` :
    `useActionFab({...})` avec l'ancienne signature (1 argument) → le bouton
    « enregistrer » de ces écrans ne marche probablement pas.
  - `app/(tabs)/home/details/[eventId].tsx:172` et `app/(tabs)/inbox/index.tsx:51` :
    config de FAB sans `visible` (erreur de type `FabConfig`).

## Ce qui reste / suivi
- Tester les changements du calendrier dans l'app (le bundle compile maintenant).
- Rien n'est commité ni poussé sur `philip-dev-s1`.

## État final (11/10/2026) — Philip
- Tout est commité sur `philip-dev-s1` (app) et `philip_dev` (API), `origin/main` fusionné
  dans les deux, PR ouvertes vers `main` pour revue du superviseur.
- Vérifié : `tsc` → seules les erreurs préexistantes (T3, T4, T13 sauf `details/[eventId]`
  corrigé ici) ; T2 réglé (suppression d'`app/modal.tsx` et `components/EditScreenInfo.tsx`).
  ESLint sur les fichiers modifiés → seules les erreurs préexistantes suivies par T8
  (`notificationItem.tsx`) et T11 (`home/index.tsx` ×7, `participantsListe.tsx` ×1).
  Jest : `tests/availability.test.js` 3/3 (StyledText-test = T1, ignoré par la CI).
  API testée en local (création, conflits, invitations, horaires, mot de passe oublié).
- Reste : tests sur appareil ; migration d'un coéquipier en attente
  (`20260928000000_conversations_couverture_optionnelle.js`) ; bugs hors sujet listés
  plus haut (exceptions récurrentes, fenêtre récurrente de `verifierDisponibilite`,
  énumération de comptes sur `/recuperation/demande`, erreurs de l'app non journalisées).

## « Jour entier » : dates d'une plage du calendrier conservées (13/10/2026) — Philip
- `components/datetimeSelecteurs.tsx` (`basculerJourEntier`) : désactiver Jour entier sur une
  plage du calendrier gardait « aujourd'hui + 1 h → début + 1 h » ; les jours sont maintenant
  conservés (début = 1er jour à l'heure suivante, fin = dernier jour une heure plus tard).
- `create.tsx` : retrait de `useRouter` / `useAccessToken` utilisés sans import (reste de la
  fusion `fix/T6-dead-code` dans `main` → la création plantait).
- Doc : `docs/12-jour-entier.md` (lien dans `docs/README.md`).
- Bug hors sujet noté (non corrigé, T13) : `app/(tabs)/home/edit/[event].tsx:161` appelle
  `useActionFab` avec l'ancienne signature → l'écran de modification devrait planter.

## Plages libres de l'horaire du membre — sélection (20/10/2026) — Philip
- Fait : sur la rangée du membre (accueil), chaque trou sans évènement est un bloc bleu pâle
  (`colors.disponible`, ajouté à `themes/generateTheme.ts`), grisé s'il est passé.
  Appui long (350 ms) puis glisser = sélection au pas de 15 min, bornée au trou de départ ;
  au relâchement : menu « Créer un évènement » (ouvre `create` avec `start`/`end`) ou
  « Ajouter une indisponibilité » (toast « bientôt » pour l'instant). Relâcher sur un
  évènement existant → toast d'erreur. Trou passé → toast « dans le passé ».
- Fichiers : `functions/trousHoraire.ts` (calcul pur + conversions position ↔ heure),
  `components/trousHoraire.tsx`, prop `arrierePlan` de `components/eventsList.tsx`,
  `app/(tabs)/home/index.tsx`, `locales/{fr,en}/home.json` (`plageLibre`),
  `tests/trousHoraire.test.js` (4/4).
- Reste : tester sur appareil (cohabitation de l'appui long avec le défilement horizontal
  et le tap sur les évènements) ; brancher « Ajouter une indisponibilité » (API + stockage).
- Mise à jour (20/10/2026) : les trous sont maintenant au style des dispos communes (contour
  bleu `colors.disponible`, fond transparent, libellé collant « Disponible » / « Date passée »).
- Mise à jour (20/10/2026) : défilement auto quand le doigt est tenu près d'un bord de la rangée
  (56 px, 60→260 px/s, s'arrête au bout du trou) ; le libellé du trou sélectionné est masqué.
  Limite : une sélection ne dépasse pas la fenêtre chargée au début de l'appui (7 jours).

## Indisponibilités — page de création (20/10/2026) — Philip
- Stockage : un évènement de `nature = 'indisponibilite'` (colonne enum ajoutée à `evenements`,
  pas `type` qui entrerait en collision avec le `type` récurrence/exception de formaterEvenement).
  Mêmes conflits, même affichage ; `prive` = raison non partagée avec les amis.
- API (sync_api, philip_dev, non commité) : migration `20261020000000_ADD_nature_to_evenements.js`
  (appliquée sur syncdb_dev), `bd/schema.sql`, middleware `lireNature` sur POST /evenements
  (titre optionnel → « Indisponible », pas de participants ni de récurrence), `creerEvenement`
  (nature), `formaterEvenement` / `retourConflit` / `trouverConflits` renvoient `nature`.
  Testé en local dans une transaction annulée (insertion, conflit, format).
- App : écran `app/(tabs)/home/indisponibilite.tsx` (EventForm `nature="indisponibilite"` :
  sans récurrence ni participants, raison optionnelle, partage de la raison, jour entier) ;
  route dans `home/_layout.tsx` ; le menu des plages libres l'ouvre avec la plage.
  Conflit (409) au moment de confirmer → toast d'erreur listant ce qui gêne
  (« Tu as déjà quelque chose cette journée-là » en jour entier).
- Reste : test sur appareil ; affichage distinct des indisponibilités sur la timeline et dans
  les détails (l'écran de détails les montre comme un évènement) ; modification / suppression.
- Mise à jour (20/10/2026) : menu de choix partagé `components/menuCreation.tsx` (« Créer un
  évènement » en bouton plein, « Ajouter une indisponibilité » en lien discret). Le « + » de
  l'accueil et du calendrier l'ouvre d'abord (`FabConfig.menuCreation`, géré dans `customTabBar`),
  avec les mêmes params pour les deux écrans ; la sélection d'une plage libre l'utilise aussi.
- Mise à jour (20/10/2026) : indisponibilités en rouge sur la rangée du membre (`colors.indisponible`,
  via `couleur` de ListItem). Rectification `create.tsx` (`retour`) : le profil de l'ami s'affiche
  d'abord, puis la création est retirée de la pile de l'accueil (l'horaire apparaissait entre les deux).
- Mise à jour (20/10/2026) : tout ce travail est la user story 20 (étiquettes @author mises à jour, app + API).
  Répétition retirée : `functions/positionTimeline.ts` (positionHeures / heuresVersDate, partagé par
  ListItem, FreeSlotItem, TrousHoraire) ; `plagePreremplie` / `debutDejaPasse` dans `functions/jourCreation.ts`
  (create.tsx + indisponibilite.tsx) ; `components/voileEnvoi.tsx`. Jest 7/7 ; ESLint home/index : 13 erreurs
  comme avant (T11), aucune nouvelle.
- Correction (20/10/2026) : le retour via `beforeRemove` + `preventDefault` de create.tsx plantait sur iOS
  (« removed natively but didn't get removed from JS state », non supporté par native-stack). Remplacé :
  depuis le profil d'un ami, la création s'ouvre dans la pile du profil (`app/(tabs)/profile/create.tsx`,
  ré-export de home/create, param `depuis: 'profil'`) ; le retour natif revient au profil, et après création
  `goBack()`. Param `retour` supprimé (create.tsx, ouvrirCreationAvecAmi, widgetDisposCommunes).

---

# HANDOFF — Écran Google Agenda (21/10/2026)

Branche : `US-18` (les 2 repos `sync` et `sync_api` sont sur `US-18`).

## Contexte determinations (à lire avant de coder)
- Le client OAuth Google configuré dans `sync_api/.env` (`219177665566-…apps.googleusercontent.com`)
  est de type **WEB** : l'authorization endpoint répond
  `Custom scheme URIs are not allowed for 'WEB' client type` pour tout schéma personnalisé,
  et `redirect_uri_mismatch` pour les URI https testées (`auth.expo.io`, `dev.syncalkemy.ca`…).
  → pour que l'app obtienne un code, il faut un client **Android/iOS/Desktop** acceptant
  `sync://oauth2redirect` (cf. `GOOGLE_REDIRECT_URI` dans `sync_api/.env`).
- `expo-auth-session` v57 n'a plus de proxy `auth.expo.io` câblé (`getStartUrl` n'est appelé
  nulle part) → pas de repli https possible depuis l'app.
- `makeClient()` envoyait `redirect_uri=` **vide** ; Google l'acceptait (l'erreur remontait
  ensuite sur le code), mais `getToken(code, options)` ignore le 2e argument (c'est le
  callback) : il faut passer un **objet** d'options pour fournir `redirect_uri` + `code_verifier`.

## App (`sync`)
- `functions/googleAgenda.ts` (nouveau) : client API de l'intégration Google —
  `chargerConfigGoogle`, `chargerComptesGoogle`, `chargerCalendriersGoogle`,
  `selectionnerCalendriersGoogle`, `resynchroniserCalendrierGoogle`, `deconnecterCompteGoogle`,
  `connecterCompteGoogle`, `suivreImportGoogle` (SSE + repli polling), `extraireProgression`.
  ⚠️ RN n'expose pas `Response.body` (le polyfill de `fetch` passe par XHR) → le flux SSE est
  lu via `xhr.responseText` dans `onprogress`, en ne traitant que les blocs terminés par `\n\n`.
- `functions/googleOAuth.ts` (nouveau) : `demanderCodeGoogle(config)` — `expo-auth-session`
  (`loadAsync` + `promptAsync`), PKCE par défaut, `access_type=offline` + `prompt=consent`
  (sans ça Google ne renvoie pas de refresh_token). Renvoie `{ code, code_verifier }`.
- `app/(tabs)/profile/settings/calendars/google.tsx` : écran complet — comptes liés
  (statut, « accès révoqué », déconnexion), connexion OAuth, liste des calendriers
  (sélection, calendrier principal, déjà lié à un autre compte), enregistrement de la
  sélection, resynchronisation d'un calendrier, progression de l'import en direct.
- `locales/{fr,en}/calendar.json` : section `google` (31 clés, same in both languages).
- `package.json` : `moduleNameMapper` `^@/(.*)$` ajouté au bloc `jest` (les modules de
  `functions/` importent via l'alias `@/`).
- `tests/googleAgenda.test.js` (nouveau) : 5 tests sur le parseur SSE.
- Docs : `docs/03-fonctions.md` (2 entrées + 4 signatures), `docs/07-config.md` (9 endpoints).

## API (`sync_api`)
- `GET /comptes/google/config` (nouveau, public) : `client_id`, `redirect_uri`, `scopes`.
- `GET /comptes/` : **réparé** (la version en cours de travail visait la table `comptes` au
  lieu de `comptes_externes`, `pool.query()` sans argument, JSON tronqué, et une injection
  SQL sur `fournisseur`). Retourne maintenant `{ comptes: [...] }` + `a_reconnecter`.
- `POST /comptes/google/connexion` : échange du code via `exchangeCode` (redirect_uri + PKCE),
  **upsert** du compte (avant : INSERT → violation de la contrainte unique en reconnexion),
  conservation du refresh_token existant si Google n'en renvoie pas.
- `POST /comptes/deconnexion/:idPublique` : **implémenté** — calendriers désactivés,
  événements supprimés en douceur (`deleted_at`), jeton neutralisé (la colonne est NOT NULL).
- `PUT /calendriers/google` : **corrigé** — le jeton était pris du *premier* compte du membre
  (le calendrier pouvait être d'un autre compte) et l'INSERT ne renseignait pas `id_compte`
  (le calendrier n'était rattaché à aucun compte). Résolution par calendrier, `id_compte`
  renseigné, `compte_origine` = le compte (et non l'id du calendrier), `label` du job.
- `POST /calendriers/syncroniser/:idPublique` : **implémenté** (resync d'un calendrier).
- `POST /calendriers/activer|desactiver` : 501 explicite (le PUT est idempotent et fait foi) —
  avant, ces stubs ne répondaient jamais et laissaient la requête en suspens.
- `src/jobs/events_imports.js` : `label` dans le snapshot du job (progression par calendrier).
- `src/functions/google.js` : `scopes`, `exchangeCode(code, codeVerifier)`, `makeClient()`
  avec le vrai `redirect_uri`.
- `src/config/env.js` : `googleRedirectUri` (nouvelle var d'env `GOOGLE_REDIRECT_URI`).

## Vérifications
- API testée en local (MySQL docker :3307, API :3100) : `GET /comptes` (200),
  `GET /comptes/?fournisseur=google` (200), `GET /calendriers/google` (200),
  `POST /comptes/google/connexion` sans code (400), `POST /comptes/deconnexion/:id` (200 :
  compte `deconnecte`, calendrier `actif=0`, 3 événements en `deleted_at`),
  `PUT /calendriers/google` sans compte (409) / sélection invalide (400),
  `POST /calendriers/syncroniser/:id` inconnu (404), `activer|desactiver` (501).
- Chemin « jeton révoqué » : jeton factice → Google `invalid_grant` → compte marqué
  `erreur` + `a_reconnecter: true` → l'app affiche « reconnectez ce compte ».
- App : `tsc` → 5 erreurs, **exactement les 5 préexistantes** (T3 + T13), aucune nouvelle ;
  `eslint` → 0 erreur sur les 4 fichiers touchés ; `jest` → 8/8 (2 suites) ;
  `npx expo export -p android` → exit 0 (les fichiers de route vides `file.tsx` /
  `system.tsx` / `outlook.tsx` ne cassent pas le build).

## Reste / à faire
- **Console Google** : créer un client Android/iOS/Desktop, y enregistrer
  `sync://oauth2redirect`, et mettre son `client_id`/`client_secret` dans `sync_api/.env`
  (`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_SECRET`). Tant que le client WEB actuel est
  utilisé, Google refuse le schéma personnalisé → la connexion OAuth ne peut pas aboutir.
- **Non testé sur appareil** : le flux OAuth (consentement, retour, échange du code) et le
  suivi SSE en conditions réelles.
- `sync_api` : le TODO `TODO_IMPORT_SYNCHRONISATION.md` n'est pas à jour (voir le commit
  correspondant) ; l'état des jobs reste en RAM (pas de table de jobs), pas de
  synchronisation incrémentale (`sync_token` jamais écrit).
- Non fait (hors périmètre choisi) : `file.tsx` / `system.tsx` (import .ics et calendriers
  système) restent vides ; `outlook.tsx` reste vide.

## Bugs hors sujet (notés, non corrigés)
- `sync_api/src/routes/evenements.js` : `DELETE /evenements/exceptions/:id` cible la table
  `exceptions` alors que la table s'appelle `evenements_exceptions` (déjà signalé).
- `sync_api/src/functions/google.js` : `importCalendar` stocke l'id Google brut dans
  `evenements.uuid_externe` (varchar 64) alors que l'import .ics y met un sha256 ; un id
  Google long tronquerait l'insertion.
- `sync_api/src/routes/calendriers.js` (`GET /google`) : le `commit()` est appelé même
  quand aucune transaction n'a été ouverte (sans conséquence avec MySQL, mais trompeur).

### Complément (21/10/2026) — contrat d'erreur affine
- `PUT /calendriers/google` distingue maintenant les deux cas de 409 :
  `409 {message:'aucun compte Google lié'}` (aucun compte du tout) vs
  `409 {message:'compte Google à reconnecter', code:'google_reauth'}` (compte existant
  mais jeton invalide). L'app affiche un toast « reconnectez ce compte » sur `google_reauth`.
- Contrat rejoué contre l'API locale (`tests` manuels, `/tmp/opencode/contrat_app.js`) :
  `GET /comptes/google/config`, `GET /comptes/`, `GET /calendriers/google`,
  `PUT /calendriers/google` (409 `google_reauth` avec un jeton factice) et
  `POST /comptes/deconnexion/:id` → toutes les formes de réponse correspondent aux types
  TypeScript de `functions/googleAgenda.ts`. Le `400 'calendrier inconnu'` n'est atteignable
  qu'avec un vrai jeton Google (non testé ici).

### Complément (21/10/2026) — désactivation d'un calendrier = suppression douce
Décision user : « quand on désactive un calendrier, on ne doit pas supprimer les
événements, mais mettre un `deleted_at` ».

**API (`sync_api`)**
- `PUT /calendriers/google` : la désactivation ne fait plus
  `DELETE FROM calendriers` (qui déclenchait le `ON DELETE CASCADE` sur
  `evenements.calendrier_id` → suppression physique). Elle fait désormais :
  `UPDATE evenements SET deleted_at = NOW() WHERE calendrier_id IN (...)` puis
  `UPDATE calendriers SET actif = 0`. Le calendrier est **conservé** (désactivé),
  il pourra être réactivé et réimporté plus tard.
- `GET /calendriers/google` (prune : calendrier disparu de Google) : même traitement
  (suppression douce + `actif = 0`), plus la transaction qui était ouverte/fermée
  incohéremment (`commit()` appelé même sans `beginTransaction()`).
- `PUT /calendriers/google` restructuré : **Google n'est plus contacté que pour les
  calendriers *nouveaux***. Conséquence : le membre peut **retirer** un calendrier
  même si son accès Google a été révoqué (sinon il était coincé avec des
  calendriers qu'il ne pouvait plus enlever). La réactivation, elle, exige un compte
  `actif` → `409 {code:'google_reauth'}`.
- `PUT /calendriers/google` renvoie `calendriers_desactives` (nombre de calendriers
  retirés) en plus de `job_id`.
- `verifierAccesEvenement` (`src/functions/authenticate.js`) et
  `GET /evenements/:idevenement` filtrent désormais `deleted_at IS NULL` : un
  événement en suppression douce n'est plus accessible par son id (403).
  ⚠️ C'était une fuite : les routes de détail ne filtraient pas `deleted_at`
  (donc un événement supprimé en douce restait lisible et modifiable).
- `POST /comptes/deconnexion/:idPublique` : inchangé (déjà en suppression douce).

**App**
- `selectionnerCalendriersGoogle` renvoie `{ jobId, calendriersDesactives }`.
- Toast « Sélection enregistrée. » / « N calendrier(s) retiré(s) de Sync. » au lieu de
  l'avertissement trompeur « aucun nouveau calendrier à importer » (l'app ne pouvait
  pas distinguer « rien n'a changé » de « j'ai retiré des calendriers »).
- i18n : `selectionSaved`, `calendarsRemoved_one/_other` (fr + en).

**Vérifié** (contrat rejoué contre l'API locale) : à la désactivation, l'événement
est **toujours en base** avec `deleted_at` renseigné, le calendrier est conservé avec
`actif = 0`, `GET /evenements/<id>` → 403, la désactivation fonctionne avec un compte
en erreur, la réactivation avec un compte en erreur → 409 `google_reauth`.

### Complément (21/10/2026) — import Google : upsert + restauration
Demande user : « les événements qui sont retrouvés soient un soft delete, les nouveaux
simplement créés ; un ON DUPLICATE UPDATE avec `deleted_at = NULL` ».

**`sync_api/src/functions/google.js`**
- L'import ne détruit plus pour reconstruire. `importCalendar` est scindé en
  `fetchEvents` (appel Google) + `appliquerImport` (écriture en base), ce qui rend le
  second testable **sans compte Google** (`tests/import_google_check.js`).
- `appliquerImport` fait, dans une seule transaction :
  1. `UPDATE evenements SET deleted_at = NOW() WHERE calendrier_id = ? AND fenêtre`
     → tout ce que Google a dans la fenêtre passe en suppression douce ;
  2. `INSERT … ON DUPLICATE KEY UPDATE debut=…, fin=…, titre=…, deleted_at = NULL`
     → les événements **retrouvés** sont restaurés et mis à jour, les **nouveaux** sont
     créés.
  L'ordre (soft delete puis upsert) évite d'avoir à distinguer « vu » / « pas vu » à la
  seconde près — une première version avec un marqueur `updated_at` avait ce défaut
  (le marqueur était en millisecondes alors que la colonne est en secondes : les
  événements juste restaurés étaient supprimés dans la foulée).
- Le conflit porte sur `(createur_id, uuid_externe)` (l'identité stable de l'événement
  chez Google). `id_publique` et `slug` ne sont pas touchés → **ils restent stables d'un
  import à l'autre** (un lien partagé vers un événement importé ne casse plus).
- Optimisation : un nouvel `id_publique` n'est généré que pour les événements vraiment
  nouveaux (avant : une requête d'unicité par événement, y compris pour ceux qui
  existaient déjà).

**🐞 Bug trouvé au passage (l'import Google n'a jamais fonctionné)**
- Le code utilisait `id_calendrier` alors que la colonne s'appelle **`calendrier_id`**
  (dans le `DELETE` et l'`INSERT`). L'import levait `ER_BAD_FIELD_ERROR` → le job
  échouait à chaque fois, la progression SSE affichait toujours une erreur. Corrigé.

**Comportement différé avec l'import `.ics`** (volontaire)
- `POST /evenements/import` ne ressuscite **jamais** un événement supprimé en douce
  (« on ne le recrée pas ») : un fichier `.ics` ne porte pas l'information de
  suppression, le ressusciter annulerait les suppressions faites par l'utilisateur.
- L'import Google, lui, ressuscite : Google est la source de vérité d'un calendrier
  connecté, et c'est ce qui fait que **réactiver** un calendrier désactivé rend ses
  événements visibles à nouveau.

**Vérifié** : `node tests/import_google_check.js` → 12/12 (A retrouve son id et son
nouvel horaire, B est restauré, C est supprimé en douceur et reste en base, D est
créé, aucun doublon). `tsc` 5 erreurs (préexistantes), `eslint` 0, `jest` 8/8.

### Complément (21/10/2026) — URI de redirection OAuth : contrainte de la console Google
La nouvelle console Google n'expose une section « Authorized redirect URIs » que pour
le client **WEB**. Pour les clients Android/iOS, Google **génère** l'URI à partir du
package / bundle id et elle n'est pas modifiable.

Comme le package Android et le bundle id iOS valent tous deux `com.alkemist.sync`,
l'URI auto-générée est la même pour les deux clients : `com.alkemist.sync:/oauth2redirect`.

Conséquences :
- `app.json` : `expo.scheme` passe de `"sync"` à `["sync", "com.alkemist.sync"]`
  (`expo.scheme` accepte un tableau) → l'app continue de gérer les liens `sync://`
  existants et reçoit en plus le retour OAuth de Google.
- `sync_api/.env` : `GOOGLE_REDIRECT_URI=com.alkemist.sync:/oauth2redirect`.
- `sync_api/src/routes/comptes.js` : `GET /comptes/google/config` sert cette URI —
  l'app ne la duplique jamais.
- ⚠️ `expo run:android` / `run:ios` ne rejouent `prebuild` que si le dossier natif est
  absent (`ensureNativeProject.js` → `if (!existsSync(platform))`). Comme `android/` et
  `ios/` existent ici, il faut **lancer `npx expo prebuild` avant le run**, sinon le
  nouveau scheme n'est pas dans le `AndroidManifest` / `Info.plist`.
- Vérificateur : `node /tmp/opencode/check_redirect.js <client_id>` interroge
  l'authorization endpoint et dit si l'URI est acceptée (et distingue « client WEB »
  de « URI non enregistrée »).

### Complément (21/10/2026) — un client OAuth Google par plateforme
Décision user : « le client envoie son OS et je prends la bonne clé ».

**`sync_api/src/config/googleClients.js` (nouveau)** — registre des clients :
- variables : `GOOGLE_OAUTH_CLIENT_ID|SECRET|REDIRECT_URI` (défaut) +
  `..._ANDROID` / `..._IOS` ;
- `get(plateforme)`, `parClientId(clientId)`, `parClientEnregistre(clientId)` ;
- garde-fou : une plateforme dont le `client_id` est posé mais pas le secret retombe
  **entièrement** sur le client par défaut (sinon l'échange utiliserait le secret
  d'un autre client et échouerait de façon incompréhensible).

**Règle Google qui a dicté l'architecture** : un `refresh_token` est lié au client
qui l'a émis. D'où la migration `20261021153000_ADD_oauth_client_id_to_comptes_externes.js`
(colonne `comptes_externes.oauth_client_id`, appliquée en base : batch 13) : l'API
mémorise le `client_id` ayant servi à lier le compte, et rafraîchit avec ce client.

**Modifications**
- `src/functions/google.js` : `makeClient(client)` et `exchangeCode(code, verifier, client)`
  prennent le client du registre ; `importCalendar` reçoit `client` (le refresh
  doit utiliser le bon client_id).
- `src/routes/comptes.js` : `GET /comptes/google/config?platform=ios|android` renvoie
  le client de la plateforme (+ `plateforme`) ; `POST /comptes/google/connexion` résout
  le client par le `client_id` envoyé par l'app (le code est lié à ce client) et
  enregistre `oauth_client_id` sur le compte.
- `src/routes/calendriers.js` : les requêtes de comptes sélectionnent `oauth_client_id`
  ; le client est résolu pour `listCalendars` et pour chaque job d'import.
- App : `chargerConfigGoogle(api, plateforme)` (`?platform=ios|android`) et
  `connecterCompteGoogle(api, code, verifier, clientId)` — le `client_id` repart avec
  le code, le secret ne quitte jamais le serveur.

**Le client par défaut reste le client WEB** : le compte déjà lié en base (membre 13)
a été obtenu avec lui, son refresh continue de fonctionner (`oauth_client_id` NULL →
repli sur le défaut). Les comptes nouveaux, eux, mémorisent leur client.

**Vérifié** : migration appliquée, `GET /comptes/google/config` et `?platform=…`
répondent, garde-fou du secret vide OK, `tsc` 5 (préexistantes), `eslint` 0, `jest` 8/8.

### Complément (21/10/2026) — clients installés = « public clients » (pas de secret)
Vérifié empiriquement contre le token endpoint de Google :

| client_id + secret | réponse Google |
|---|---|
| Android + **secret du client WEB** | ❌ `invalid_client — The provided client secret is invalid.` |
| Android + **aucun secret** | ✅ `invalid_grant — Malformed auth code.` (client accepté) |
| WEB + son secret | ✅ accepté |

→ Le `client_secret` est lié à son client : celui du client WEB ne peut **pas** servir
avec le client Android/iOS. Un client installé (Android/iOS) est un *public client* :
Google ne lui donne pas de secret et l'échange du code se fait **sans secret** — c'est
le rôle du `code_verifier` PKCE.

**`src/config/googleClients.js`** : un client de plateforme n'a besoin que de son
`client_id` ; son secret est optionnel (vide → public client). Le secret du client par
défaut n'est **jamais** hérité par un client de plateforme (sinon `invalid_client`).
Garde-fou révisé : une plateforme est configurée dès qu'elle a un `client_id`.

**`sync_api/.env`** : `GOOGLE_OAUTH_SECRET_ANDROID` / `_IOS` à laisser **vides**.

**État vérifié** :
```
défaut    → client …brire8uvr…  secret: présent        (compte déjà lié en base)
android   → client …jarvpnekm…  secret: AUCUN          (public client)
ios       → client …qkd2ulqk…   secret: AUCUN          (public client)
```
Les deux clients acceptent `com.alkemist.sync:/oauth2redirect` (vérifié via
`/tmp/opencode/check_redirect.js`).

---

# HANDOFF — Écran Outlook (`outlook.tsx`) + client API Outlook (28/10/2026)

## Fait
- `sync/functions/outlookAgenda.ts` (nouveau) : client de l'intégration Outlook —
  `chargerConfigOutlook` (`GET /comptes/outlook/config`),
  `chargerComptesOutlook` (`GET /comptes/?fournisseur=outlook`),
  `chargerCalendriersOutlook` (`GET /calendriers/outlook`),
  `selectionnerCalendriersOutlook` (`PUT /calendriers/outlook` `{calendar_ids}`),
  `resynchroniserCalendrierOutlook` (`POST /calendriers/syncroniser/:idPublique`),
  `deconnecterCompteOutlook` (`POST /comptes/deconnexion/:idPublique`),
  `connecterCompteOutlook` (`POST /comptes/outlook/connexion` `{code, code_verifier}`),
  `suivreImportOutlook` (délègue au suivi SSE générique `suivreImportGoogle`).
- `sync/functions/outlookOAuth.ts` (nouveau) : `demanderCodeOutlook(config)` —
  `expo-auth-session` (`AuthSession.loadAsync` + `AuthRequest.promptAsync`),
  PKCE S256 par défaut, `prompt: AuthSession.Prompt.Consent` (refresh_token MS),
  discovery partiel `{ authorizationEndpoint: config.authorize_url }` (source de
  vérité côté serveur). `ConfigurationOAuthInvalide` identique au flux Google.
- `sync/app/(tabs)/profile/settings/calendars/outlook.tsx` (rempli) : miroir de
  l'écran Google — comptes liés (statut, « accès révoqué », déconnexion),
  connexion OAuth, liste des calendriers (coche/décocher, calendrier principal,
  déjà lié à un autre compte, dernière synchro), sélection, resynchronisation,
  progression d'import SSE + toast. Pas de modal de personnalisation (nom/couleur) :
  **aucun endpoint `PATCH /calendriers/outlook/:idPublique` n'existe** côté API
  (seul `PATCH /calendriers/google/:idPublique` existe) → resync inline uniquement.
- `locales/{fr,en}/calendar.json` : section `outlook` ajoutée (35 clés, même shape que
  `google`, clés `_one`/`_other` pour `calendarsRemoved`).

## Décisions / écarts vs Google (volontaires)
- `suivreImportOutlook` délègue à `suivreImportGoogle` : le suivi SSE/polling est
  partagé (endpoint `GET /calendriers/imports/:id/events` générique). Pas de doublon.

## Vérifications
- `npx tsc --noEmit` : 5 erreurs préexistantes (touches `abstractions/` + `app/(tabs)/home|inbox`),
  **aucune nouvelle** (les nouveaux fichiers sont propres).
- `npx eslint` sur les 3 fichiers créés/touchés : 0 erreur (1 warning `no-unused-expressions`
  sur la ternary de déconnexion — **préexistant et identique** dans `google.tsx:382`).
- `npx jest` : 3 suites / 12 tests passent (inchangé).
- JSON locales : validés (python json.load).

## Reste / à faire
- **API** : ajouter `PATCH /calendriers/outlook/:idPublique` (nom / couleur) si la
  personnalisation doit être offerte pour Outlook — aujourd'hui l'écran n'y accède pas.
- **Console Microsoft** : client_id/secret/tenant/redirect côté `sync_api/.env`
  (cf. section Google : client public, PKCE, refresh token) ; flow OAuth non testé
  sur appareil (comme pour Google).
- **Docs** : `docs/03-fonctions.md` / `docs/07-config.md` n'ont **pas** encore été
  étendus pour les endpoints Outlook (`GET /comptes/outlook/config`, `GET /calendriers/outlook`,
  `PUT /calendriers/outlook`, `POST /calendriers/syncroniser/:idPublique`,
  `POST /comptes/outlook/connexion`, `POST /comptes/deconnexion/:idPublique`).
- Non fait (hors périmètre) : `file.tsx` / `system.tsx` (import .ics / calendriers système).

## Note technique
- Le screen utilise `t('outlook.…')` (namespace `calendar`), icône `logo-microsoft`
  (Ionicons), `RenderCalendarColor(couleur ?? 275, scheme)`.

### Complément (28/10/2026) — convergence des logiques Google / Outlook
- `hooks/useAgendaImport.ts` est maintenant utilisé par **les deux écrans** pour
  charger comptes/calendriers, gérer la sélection, suivre les imports SSE/polling,
  resynchroniser, connecter et déconnecter les comptes.
- Le hook garde les adaptateurs du fournisseur dans une ref synchronisée par effet
  afin que les callbacks de chargement restent stables pour `useFocusEffect` ; ses
  types génériques préservent les discriminants `source: 'google' | 'outlook'`.
- Google conserve son modal de personnalisation : la mise à jour optimiste locale
  passe désormais par `mettreAJourCalendrier` du hook, puis par son endpoint Google.
- Le hook transporte aussi `client_id` facultatif dans le résultat OAuth et dans
  le callback de connexion : Google le renvoie à l'API comme avant, Outlook ne le
  fournit pas. Les flux OAuth eux-mêmes partagent `functions/oauth.ts`.
- Vérifications : Jest 3 suites / 12 tests passent ; ESLint ciblé 0 erreur (deux
  warnings `no-unused-expressions` sur les ternaires de déconnexion des deux écrans) ;
  `tsc` reste à 5 erreurs, toutes préexistantes et hors des fichiers Agenda
  (`abstractions/touchableOpacityAbs.tsx`, `app/(tabs)/home/edit/[event].tsx`,
  `app/(tabs)/inbox/index.tsx`).
- Suites restantes inchangées : ajouter l'endpoint de préférences Outlook si cette
  fonction doit être offerte, compléter `docs/03-fonctions.md` et `docs/07-config.md`
  pour Outlook, et tester les flux OAuth sur appareil avec la configuration Microsoft.

---

# HANDOFF — Dispos communes exactes (revue d'invitation) + « Proposer un report » dans la gestion (13/11/2026)

## Fait (lint 0 sur les fichiers touchés, `tsc --noEmit` OK, `jest` 17/17)
- `functions/disponibilitesCommunes.ts` (nouveau) : intervalles où ≥ 2 participants
  sont libres, par participant (bloc seulement chez les personnes libres), coupés
  uniquement partiel ↔ tout le monde ; `segments` = qui est libre, morceau par morceau.
  Tests : `tests/disponibilitesCommunes.test.js` (4 cas).
- `functions/availability.js` : `applyBusyTimes` exporté (réutilisé), JSDoc `Uint8Array`.
- `components/blocDispoCommune.tsx` (nouveau) : bloc positionné exactement (positionHeures,
  sans taille min), orange/vert (`colors.dispoPartielle` / `colors.dispoTous`, ajoutés à
  `themes/generateTheme.ts`), « 3/4 » + noms, icône d'envoi si créneau proposable.
- `components/detailDispoCommune.tsx` (nouveau) : détails au toucher (pas de survol sur mobile).
- `app/(tabs)/home/revueInvitation.tsx` : blocs dorés à taille fixe et FreeSlotItem
  (dispos membre ↔ ami) remplacés par les nouveaux blocs (via `arrierePlan` d'EventsList),
  légende 2 couleurs. Proposer depuis la revue : toucher un bloc de MA rangée qui contient
  un créneau de GET /postpone → même ConfirmationEnvoi + `envoyerCreneau` qu'avant.
- `components/selecteurReport.tsx` (nouveau) + `components/panneauReport.tsx` (prop
  `plageActuelle`) + `components/panneauGestionEvenement.tsx` : « Proposer un report »
  (date + heure, durée conservée) dans la gestion d'évènement ; envoi via `envoyerCreneau`
  (invité → POST /postpone/evenements/:id, créateur → /deplacer). Sans `plageActuelle`
  (page détails), PanneauReport est inchangé.
- Locales fr/en `events.json` : clés `invitationReview.*` et `postpone.*` ajoutées ;
  `invitationReview.commonSlot` retirée (plus utilisée).

## Non testé
- Pas lancé sur appareil/simulateur (pickers natifs iOS/Android, rendu des blocs) : à
  vérifier à la main.

## À savoir
- L'API ferme une proposition dès qu'un participant n'est pas libre à ce moment
  (GET /postpone/evenements/:id → personnesOccupees) : une plage choisie librement au
  sélecteur où quelqu'un est occupé disparaît de la liste au rechargement suivant.

## Bugs hors sujet (non corrigés)
- `components/datetimeSelecteurs.tsx:334,356,381,403` : `onChange` déprécié dans
  @react-native-community/datetimepicker 9.2.1 (warning en dev) ; sur Android, une
  annulation (date undefined) ne remet pas le flag `show*` à false.
- `components/freeSlotItem.tsx:123-124` : texte du toast « dans le passé » codé en dur
  en français (pas i18n).

## Ajout (13/11/2026) — corbeille retirée des détails d'une invitation
- `components/notificationItem.tsx:533` : la corbeille (poubelle avec x, fond rouge) n'est
  plus affichée dans la carte dépliée d'une invitation (`!invitation && corbeille(...)`).
  Toujours là pour les autres notifications d'évènement.
- Bug hors sujet (non corrigé) : `components/notificationItem.tsx:180-198` `supprNotif`
  supprime avec `axios.delete` brut (sans jeton → refusé par l'API) et sans attendre les
  requêtes ; la corbeille des autres notifications d'évènement ne marche donc pas non plus.
  La suppression en sélection (`app/(tabs)/feed/notifications/list.tsx:115`, via `api`) marche.

## Ajout (13/11/2026) — noms affichés dans les blocs de dispo
- `components/blocDispoCommune.tsx` : les noms s'affichent toujours dans le bloc (orange et
  vert), plus seulement au toucher ; bloc partiel où les personnes changent = toutes les
  personnes libres pendant le bloc (le détail au toucher garde le morceau par morceau).
  Plus de seuil de largeur pour les noms (texte réduit jusqu'à 70 %, 4 lignes max).

---

# HANDOFF — Hold & drag réutilisable + plage précise dans une dispo commune (13/11/2026)

## Décisions du user
- Durée : l'API accepte maintenant n'importe quelle durée de proposition (avant : durée
  de l'évènement obligatoire, sinon 400).
- Sélection seulement dans la rangée « Moi » de la revue d'invitation (seule vue avec
  des blocs de dispo commune ; la vue de gestion n'a pas de ligne du temps).

## Fait (lint 0, `tsc --noEmit` OK, `jest` 17/17)
- `hooks/useSelectionGlissee.ts` (nouveau) : logique hold & drag extraite de TrousHoraire,
  à l'identique (appui 200 ms, défilement auto aux bords, ancre, aimantation, tap pour
  effacer) ; paramètres : `pasMinutes`, `zones` (+ `refusee`), `obstacles`, `clampOffset`,
  `effacerAuToucher`, callbacks de refus / début.
- `components/selectionGlissee.tsx` (nouveau) : GestureDetector + blocs (children) +
  surbrillance avec heures ; l'état du glissement vit ici (un pas ne re-rend pas l'écran).
- `components/trousHoraire.tsx` : utilise SelectionGlissee (pas 15 min, passé / relâcher
  sur un évènement refusés) — comportement inchangé ; `PlageChoisie` ré-exporté.
- `app/(tabs)/home/revueInvitation.tsx` : SelectionGlissee dans la rangée « Moi » (pas
  5 min, zones = mes blocs de dispo, partie passée refusée avec toast) ; bouton
  « Proposer {plage} » sous la ligne du temps (hors détecteur des rangées) →
  `envoyerCreneau` ; tap ailleurs (rangées, en-tête) efface ; le début d'un glissement
  ferme la carte de détails.
- `hooks/useReportEvenement.ts` : `creneauDepuisPlage` (plage locale → format API),
  réutilisé par `components/selecteurReport.tsx`.
- Locales fr/en : `invitationReview.proposeHint`, `invitationReview.proposeRange`.
- API `../sync_api/src/routes/postpone.js` : POST /postpone/evenements/:id accepte toute
  plage future non vide ; doublon = même début ET même fin ; `deja_propose` des créneaux
  du GET comparé sur début + fin.

## À faire / à vérifier
- Déployer sync_api (sinon une plage d'une autre durée que l'évènement reste refusée 400).
- Test manuel sur appareil : hold & drag de l'accueil (rien ne doit changer), sélection
  dans la revue (pas 5 min, bornée au bloc), « Proposer », tap ailleurs.
- Appliquer une telle proposition change aussi la durée de l'évènement (voulu).

## Ajout (13/11/2026) — évènement invité dans toutes les rangées, couleur du statut
- `app/(tabs)/home/revueInvitation.tsx` : l'évènement invité est ajouté côté app dans les
  rangées où l'API l'omet (invité en attente / refus), depuis `horaires.evenement`, avec
  `statut_invitation` = statut de la personne ; ne rend toujours pas occupé (occupes).
- `functions/couleurStatutInvitation.ts` + `themes/generateTheme.ts` (`enAttente`) : en
  attente = orange (au lieu de jaune) ; aussi dans la liste des participants de la page
  de décision (même fonction).
- `components/listItem.tsx` : bug corrigé (dans le sujet) — depuis 3f5a664 (Outlook),
  `event.couleur` passait toujours par RenderCalendarColor (teinte numérique) : les
  couleurs prêtes de la revue (`hsl(...)` : statuts, gris « privé ») devenaient
  `hsl(hsl(...), …)`, invalides. Une couleur chaîne est maintenant utilisée telle quelle.
- Non corrigé, hors sujet : `components/notificationItem.tsx:426` colore « en attente »
  avec `colors.warning` (jaune) en dur, pas via couleurStatutInvitation.

## Ajout (13/11/2026) — noms toujours visibles dans les blocs de dispo (2e passe)
- User : les blocs partiels n'affichent encore que « 12/14 » sans toucher. Le code rendait
  bien les noms ; cause probable : `adjustsFontSizeToFit` sur un Text multi-ligne sans
  hauteur fixe. `components/blocDispoCommune.tsx` : retiré sur les noms, taille / interligne
  fixes (11 / 13, `includeFontPadding: false`), 4 lignes, étiquette jusqu'à 150 px.
- À confirmer sur appareil (plateforme non connue) ; si toujours seulement le compte :
  demander iOS / Android et une capture.

## Ajout (13/11/2026) — « tout le monde dispo » seulement si assez long pour l'évènement
- `functions/disponibilitesCommunes.ts` : option `dureeMinTous` (minutes) ; un passage où
  tout le monde est libre moins longtemps est partiel (orange) et se fond dans les blocs
  partiels voisins (segments exacts conservés). Borné à la journée affichée.
- `app/(tabs)/home/revueInvitation.tsx` : durée = `horaires.evenement` (fin − début), à
  défaut les bornes de l'invitation.
- `components/detailDispoCommune.tsx` : note `invitationReview.allTooShort` quand un bloc
  orange contient un moment où tout le monde est libre.
- Test ajouté (jest 18/18).

## Ajout (13/11/2026) — compte seul dans le bloc, détails + proposition dans une modale
- J'avais mal compris 2 fois : le user veut SEULEMENT le compte (« 14/16 ») dans le bloc
  (orange et vert), les noms seulement au toucher.
- `components/blocDispoCommune.tsx` : compte seul (noms seulement dans l'accessibilityLabel).
- `components/detailDispoCommune.tsx` : contenu de modale ; plages exactes (segments) avec
  compte et noms, chacune touchable (état interne) → `ConfirmationEnvoi` « Proposer {plage} »
  ; sans plage choisie : le créneau GET /postpone du bloc (rangée « Moi ») comme avant.
- `app/(tabs)/home/revueInvitation.tsx` : toucher un bloc (toute rangée) ouvre la modale
  générique `/(modals)/dataRenderer` (contenu via `setDataRendererContent`, clé
  `revueInvitation-dispo`, tenu à jour pendant qu'elle est ouverte) ; envoyé →
  `modalEvents.emitClosing()` ; retour → bloc dé-sélectionné. Carte entre les rangées retirée.
- Retour sur l'écran : le défilement vers l'heure de l'évènement ne se fait plus qu'une
  fois par invitation (avant : à chaque focus, donc après chaque modale / page poussée).
- Plage déjà proposée (même début et fin) : marquée et non touchable ; plage commencée :
  proposée à partir de maintenant (pas de 5 min).

## Ajout (13/11/2026) — plus d'espace, pas de « x », jamais un bloc dans un bloc
- `components/modalBase.js` : prop `afficherBoutonFermer` (défaut true, JSDoc de toutes
  les props — sinon tsc restreint les props aux seules documentées) ;
  `app/(modals)/dataRenderer.tsx` : param `sansBoutonFermer: '1'` ; la modale des dispos
  de la revue l'utilise (fermeture : glisser vers le bas / toucher dehors).
- `app/(tabs)/home/revueInvitation.tsx` : textes d'aide retirés de l'en-tête (hint
  « Touche l'évènement de… », availabilityHint, proposeHint) ; légendes gardées.
  `components/detailDispoCommune.tsx` : « Touche une plage pour la proposer » retiré.
  Clés supprimées des locales fr/en : hint, availabilityHint, proposeHint,
  tapRangeToPropose, closeDetails.
- Dispos communes : la plage de l'évènement invité est occupée pour tout le monde dans
  le calcul (son bloc est dans toutes les rangées) → une dispo 3-7 avec l'évènement 4-5
  donne 3-4 et 5-7. Test ajouté (jest 19/19).

## Révision complète de la session (13/11/2026)
- Relu tous les fichiers touchés (app + `sync_api/src/routes/postpone.js`) ; aucun bug
  bloquant trouvé. Vérifs : eslint 0 erreur sur les 19 fichiers touchés (3 warnings
  préexistants dans notificationItem.tsx, lignes non touchées), `tsc --noEmit` OK,
  jest 19/19, `node --check` de la route API OK.
- Optimisations `app/(tabs)/home/revueInvitation.tsx` :
  - bornes de l'invitation calculées une fois, jour mémorisé (dépendance stable pour
    les calculs et le hold & drag) ;
  - `lignes` + `evenementsParPersonne` mémorisés : les évènements de chaque rangée sont
    convertis une fois par chargement (avant : 2× par rangée à chaque rendu) ;
  - `plageInitiale` mémorisée ; `blocsParPersonne` sans eslint-disable (dépendances
    exactes) ; `occupes` sortie du composant (fonction pure) ; type `Role` ;
  - `creneauxLocaux` : créneaux GET /postpone convertis une fois ; `prochainPas()`
    partagé (était dupliqué) ; constante `PAS_PROPOSITION_MINUTES` ;
  - retiré `onDebutGlissement` (inutile depuis la modale) ici et dans
    `hooks/useSelectionGlissee.ts` ; `LARGEUR_TEXTE_SELECTION` plus exportée.
- Commentaires mis à jour : en-tête de RevueInvitation (modale, compte seul, split
  autour de l'évènement, défilement une fois), commentaire faux de `rangee` (le bloc
  de l'évènement ne chevauche plus de dispo), callbacks documentés dans le hook,
  en-tête de `postpone.js` (toute durée).
- Toujours à faire : tester sur appareil ; déployer sync_api ; `package-lock.json`
  modifié hors de nos changements (drapeaux `peer` seulement) — à garder ou annuler.

## Ajout (13/11/2026) — propositions partielles visibles + anciennes notifs désactivées
- Bug : une proposition faite depuis une dispo partielle n'apparaissait jamais dans les
  détails. Cause API : GET /postpone/evenements/:id fermait toute suggestion où un
  participant était occupé (règle US23 « vit tant que tout le monde est libre »).
- Décision user : « toujours ouverte ». `sync_api/src/routes/postpone.js` : plus de
  fermeture à la lecture, au vote, ni à l'application (le créateur applique quand même :
  non → absent, sans vote → redemandé) ; `fermerSuggestion` retirée ;
  `personnesOccupees` ne sert plus qu'à `/deplacer` (déplacement direct, inchangé).
- Demande user : après application d'un vote, les anciennes notifs ne marchent plus et
  de nouvelles partent. `deplacerEvenement` marque `remplacee: true` (payload JSON) les
  notifs `invitation_evenement` de l'évènement AVANT d'envoyer les nouvelles ;
  `src/routes/notifications.js` ne les résout plus (pas de statut / actions) et renvoie
  `remplacee`. `id_metier` gardé (les suppressions par id_metier marchent encore). Les
  notifs de vote s'éteignent seules (suggestion fermée / appliquée).
- App : `Notification.remplacee` (contexteNotifications), `notificationItem.tsx` affiche
  `expiration.replaced` au lieu du panneau, pas de corbeille sur une invitation
  (condition sur `item.type`) ; commentaires PanneauReport / useReportEvenement à jour.
- Vérifs : node --check des 2 routes, eslint 0 erreur (4 warnings préexistants), tsc OK,
  jest 19/19. À DÉPLOYER (sync_api) + tester : proposer depuis une dispo partielle → visible
  dans les détails ; voter ; appliquer → ancienne invitation « remplacée », nouvelle active.

## Ajout (13/11/2026) — évènement déplacé : même carte qu'avant pour tout le monde
- User : après application d'un vote, l'évènement changé avait une autre carte (avec la
  poubelle) et le proposeur ne pouvait plus le gérer / le quitter (son ancienne
  invitation est « remplacée », et il ne recevait qu'un avis « plage changée »).
- `sync_api/src/routes/postpone.js` (`deplacerEvenement`) : TOUS les invités reçoivent une
  notif `invitation_evenement` (id_metier = leur invitation) pour la nouvelle plage, avec
  leur statut (oui → acceptée : panneau de l'évènement, « Quitter » ; non → refusée :
  page des refusées ; sans vote → en attente : accepter / refuser). Avant : avis
  informatif `evenements` pour ceux qui avaient voté. Repli informatif si aucune ligne
  d'invitation.
- `components/notificationItem.tsx` : plus de corbeille sur aucune carte d'évènement
  dépliée (même format partout ; la suppression de la carte ne marchait pas). Sélection
  par appui long toujours possible pour supprimer.
- Vérifs : node --check OK, eslint 0 erreur, tsc OK. À déployer (sync_api) et tester.

## Ajout (13/11/2026) — plus de proposition une fois dans l'évènement ; participants visibles
- Décision user : un participant qui a accepté ne propose plus de report, mais vote
  toujours, et voit la liste des participants avec leur statut.
- `sync_api/src/routes/postpone.js` : GET `peut_proposer` = reportable && pas créateur &&
  statut ≠ 'acceptee' ; POST /evenements/:id → 403 si déjà accepté. Le vote est inchangé.
  L'app suit `peut_proposer` partout (SelecteurReport, maintenir-glisser et modale de la
  revue) : rien d'autre à brancher.
- `components/listeParticipantsStatut.tsx` (nouveau) : liste déroulante des participants
  et de leur statut, extraite de PanneauDecisionInvitation (qui l'utilise, même rendu) ;
  ajoutée dans PanneauGestionEvenement hors invitation (participant accepté ET créateur).
- Commentaires « un invité propose » précisés (« qui n'a pas encore accepté »).
- Vérifs : node --check OK, eslint propre, tsc OK, jest 19/19. À déployer (sync_api).

## Ajout (13/11/2026) — carte d'évènement compacte + CI propre
- Carte d'un évènement accepté : l'écart message → date venait de la rangée du statut
  (hauteur fixe 36 px, vide sans boutons depuis le retrait de la corbeille) + marge du
  panneau. `notificationItem.tsx` : cette rangée n'existe plus que s'il y a des boutons
  (vote oui / non) ; sinon le statut est passé à `PanneauGestionEvenement` (`statut`),
  affiché à droite de la date. Panneau : gap 12 → 8, paddingTop 12 → 8.
- CI (`.github/workflows/ci.yml`) rejouée en local : `npx eslint` sur les 22 fichiers
  JS/TS modifiés / nouveaux → 0 erreur, 0 warning ; tsc OK ; jest (commande CI) 19/19.
  Warnings préexistants traités dans les fichiers touchés : `Array<string>` → `string[]`
  (notificationItem ×2) ; exhaustive-deps (notificationItem, contexteNotifications) gardés
  tels quels avec eslint-disable justifié (les ajouter bouclerait / relancerait les anims).
- Non vérifié : `npm ci` (CI) avec le `package-lock.json` modifié hors de nos changements.

---

# HANDOFF — Composant panneauOsMetriques (13/11/2026)

## Fait
- Lu l'existant : `components/panneauMetriques.tsx` (398 l, entier), `app/(tabs)/profile/admin.tsx` (entier), `components/PanneauCollapsable.tsx` (entier), `components/datetimeSelecteurs.tsx` (entier), `contextes/contexteAPI.tsx`, `locales/{fr,en}/profile.json`, `package.json`, `.agents/AGENTS.md` (entier).
- `components/PanneauCollapsable.tsx` : ajout de la prop optionnelle `onOuvert?: () => void`, appelée quand le panneau passe à l'état ouvert (chargement paresseux). Impact nul sur les appelants existants.
- Créé `components/panneauOsMetriques.tsx` :
  - Appelle `GET /os_metrics` (pas de préfixe `/admin`, confirmé par l'user) via `useAPI()`.
  - Sélecteur de période : `historique` (aucune query), `24h`, `7j`, `30j`, `90j`, `personnalise`.
  - En mode `personnalise` : date pickers natifs (`@react-native-community/datetimepicker`) pour `start` et `end`, envoyés en query à l'API.
  - Chargement paresseux : chaque `PanneauCollapsable` (Système, Disque, Échantillons) déclenche le fetch à son ouverture (`onOuvert`), résultat mis en cache par période pour éviter les refetchs à l'ouverture/fermeture.
  - États : idle / chargement / pret / erreur, avec gestion 401/403 via `onAccesRefuse`.
  - Traductions attendues sous `admin.os_metrics.*` (à ajouter dans locales).

## Reste à faire
1. Intégrer l'onglet dans `app/(tabs)/profile/admin.tsx` : ajouter une page `os_metrics` (ou renommée) dans `PagesGlissables`, avec `titre: t('admin.os_metrics.tab')` et contenu `<PanneauOsMetriques onAccesRefuse={sortirAccesRefuse} />`.
2. Ajouter les clés traductions `fr` et `en` dans `locales/{fr,en}/profile.json` sous `admin.os_metrics` (title, periode, historique, periode24h/7j/30j/90j, personnalise, debut, fin, systeme, disque, echantillons, cpu, memoireRss, heapUtilise, octetsExternes, disqueTotal, disqueUtilise, disqueDisponible, utilisationDisque, nbEchantillons, periodeSousTitre, loadFailed, empty).
3. (Optionnel, demandé par l'user) renommer l'onglet `metriques` existant et/ou son libellé pour mieux refléter "membres métriques".
4. Faire passer `eslint` + `tsc --noEmit` sur les fichiers touchés (règle AGENTS.md) et corriger les erreurs lint.
5. Mettre à jour ce HANDOFF à la fin.

## Non fait / blocants
- Rien de bloquant. L'user se déconnecte d'internet ; le code est écrit localement, pas de besoin réseau.

## Règles respectées
- AGENTS.md : pas de devinette sur l'endpoint (confirmé `/os_metrics`), append au HANDOFF (pas de réécriture), eslint/tsc à venir sur fichiers modifiés.

---

# HANDOFF — Composant panneauOsMetriques (13/11/2026) — TERMINÉ

## Fait
- `components/panneauOsMetriques.tsx` créé :
  - Appelle `GET /os_metrics` (pas de préfixe `/admin`, confirmé par l'user) via `useAPI()`.
  - Sélecteur de période : `historique` (aucune query), `24h`, `7j`, `30j`, `90j`, `personnalise`.
  - En mode `personnalise` : date pickers natifs (`@react-native-community/datetimepicker`) pour `start` et `end`, envoyés en query à l'API.
  - Chargement paresseux : chaque `PanneauCollapsable` (Système, Disque, Échantillons) déclenche le fetch à son ouverture (`onOuvert`), résultat mis en cache par clé de période (période + bornes) pour éviter les refetchs.
  - États : idle / chargement / pret / erreur, avec gestion 401/403 via `onAccesRefuse`.
  - Traductions : clés sous `admin.os_metrics.*` ajoutées dans `locales/{fr,en}/profile.json`.
- `components/PanneauCollapsable.tsx` : ajout de la prop optionnelle `onOuvert?: () => void`, appelée quand le panneau passe à l'état ouvert. Aucun impact sur les appelants existants.
- `app/(tabs)/profile/admin.tsx` : nouvel onglet `os_metrics` (titre `admin.osMetricsTab` = "OS") ajouté dans `PagesGlissables`, avec `<PanneauOsMetriques onAccesRefuse={sortirAccesRefuse} />`.
- `locales/fr/profile.json` et `locales/en/profile.json` : clé `osMetricsTab` + bloc `os_metrics` ajoutés.
- Vérifications : `tsc --noEmit` → 0 erreur sur les fichiers touchés ; `eslint` sur les 3 fichiers → 0 erreur, 0 warning.

## Optionnel (non fait, à la discrétion de l'user)
- Renommer l'onglet `metriques` existant (libellé `admin.metricsTab`) pour mieux refléter "membres métriques". L'user a dit "si tu veux" — non bloquant, laissé en l'état.

## Règles respectées (AGENTS.md)
- Pas de devinette sur l'endpoint (confirmé `/os_metrics`).
- Append au HANDOFF (jamais de réécriture).
- eslint + tsc passés sur chaque fichier modifié avant de considérer terminé.

## État final
Tâche terminée. Le composant est intégré comme nouvel onglet "OS" du dashboard admin, cohérent avec l'organisation de `panneauMetriques` (entête, panneaux repliables, styles palette/font) mais avec sa propre logique et ses propres endpoints.

---

# HANDOFF — Correctif : rechargement auto sur changement de période (13/11/2026)

## Problème
Quand l'utilisateur changeait de période dans `panneauOsMetriques.tsx`, la clé de cache changeait et l'état passait à `'idle'`, mais **aucun fetch n'était déclenché automatiquement**. Le chargement ne se lançait que si l'utilisateur ouvrait un panneau repliable (`onOuvert`) ou cliquait sur « Actualiser ».

## Correctif
Ajout d'un `useEffect` dans `panneauOsMetriques.tsx` qui appelle `charger(false)` dès que `cleCache` (période + bornes de dates) change. Le rechargement est donc automatique à chaque changement de période ou de date personnalisée.

Pour respecter la règle ESLint `react-hooks/set-state-in-effect`, l'appel à `charger` passe par une `useRef` (`chargerRef`) plutôt qu'un `setState` direct dans le corps de l'effet.

## Vérifications
- `tsc --noEmit` → 0 erreur sur `panneauOsMetriques.tsx`
- `eslint` sur `panneauOsMetriques.tsx` → 0 erreur, 0 warning

---

# HANDOFF — Voile de chargement (13/11/2026)

## Fait
- `components/panneauOsMetriques.tsx` : import de `VoileEnvoi` depuis `@/components/voileEnvoi` et affichage en overlay `{enChargement && <VoileEnvoi />}` pendant le chargement de la période courante.
- Retrait des `ActivityIndicator` individuels dans chaque panneau collapsable (ils étaient redondants avec le voile global).
- `ActivityIndicator` retiré des imports (plus utilisé).

## Vérifications
- `tsc --noEmit` → 0 erreur sur `panneauOsMetriques.tsx`
- `eslint` sur `panneauOsMetriques.tsx` → 0 erreur, 0 warning

L'utilisation du voile est cohérente avec `creationEvenement.tsx` et `creationIndisponibilite.tsx`.

---

# HANDOFF — Graphique de tendance OS (13/11/2026)

## Fait
- `components/panneauOsMetriques.tsx` :
  - Ajout d'un graphique `LineChart` (via `react-native-chart-kit`, customisable, basé sur `react-native-svg` déjà présent) affichant la tendance CPU sur la période sélectionnée.
  - Nouvel appel API `GET /admin/os_metrics/points` (fetch automatique au changement de période, cache dédié).
  - Le panneau "historique" n'a pas de série temporelle (graphique vide).
  - Nouveau panneau collapsable pour le graphique n'est pas ajouté : le graphique est toujours visible au-dessus des panneaux Système/Disque/Échantillons.
  - Traduction `admin.os_metrics.tendanceCpu` ajoutée (fr/en).
- `types/react-native-chart-kit.d.ts` (nouveau) : déclaration de types pour `react-native-chart-kit`.
- `package.json` : ajout de `react-native-chart-kit`.
- Vérifications : `tsc --noEmit` → 0 erreur ; `eslint` → 0 erreur, 0 warning.

## À faire côté serveur (par l'user)
- Ajouter `getPointsAverageBetween` au `metricsModel` (SQL fourni dans la discussion).
- Ajouter la route `GET /os_metrics/points` (préfixée `/admin` par Express Router) qui appelle ce modèle.

## Règles respectées (AGENTS.md)
- Pas de devinette : l'URL `/admin/os_metrics` est confirmée (déjà corrigée par l'user).
- Append au HANDOFF (jamais de réécriture).
- eslint + tsc passés sur les fichiers modifiés.

---

# HANDOFF — Remplacement react-native-chart-kit par react-native-svg (13/11/2026)

## Problème
`react-native-chart-kit` provoque une erreur au runtime : `Cannot read property 'reduce' of undefined` dans `LineChart.js` dès qu'on change de période. La librairie est buggée et sans types TypeScript.

## Correctif
- Retiré `react-native-chart-kit` (plus d'import `LineChart`).
- Le graphique de tendance CPU est maintenant dessiné manuellement avec `react-native-svg` (déjà installé en v15.16.0 dans le projet) : composant `GraphiqueCpu` qui trace la ligne, les points, les axes X/Y et les labels.
- Supprimé `types/react-native-chart-kit.d.ts` (plus nécessaire).
- `package.json` : `react-native-chart-kit` toujours présent (installé précédemment) mais plus importé.

## Vérifications
- `tsc --noEmit` → 0 erreur
- `eslint` sur `panneauOsMetriques.tsx` → 0 erreur, 0 warning

## À faire côté serveur (par l'user)
L'endpoint `GET /admin/os_metrics/points` n'existe pas encore : "je get aucuns points". Il faut ajouter `getPointsAverageBetween` dans `metricsModel` et la route correspondante (SQL fourni dans les messages précédents).

# HANDOFF - Date du jour sur l'accueil au retour dans l'application (18/11/2026)

## Fait
- `app/(tabs)/home/index.tsx` conservait le jour pr?c?demment affich? lors du focus. Ajout d'un traitement du cycle d'?tat de l'application : apr?s un passage en arri?re-plan, l'accueil revient ? aujourd'hui s'il est d?j? actif, ou marque ce retour pour le prochain focus.
- La s?lection faite en naviguant dans le calendrier reste conserv?e lors des transitions internes; le retour au premier plan de l'application r?initialise l'accueil au jour courant.
- Aucun changement API requis.

## V?rifications
- `npx.cmd eslint 'app/(tabs)/home/index.tsx'` : 0 erreur, 8 avertissements pr?existants dans ce fichier.
- Tests et typecheck non ex?cut?s.

# HANDOFF - Fen�tre initiale de l'accueil (18/11/2026)

## Fait
- Au premier focus, l'accueil activait son �couteur de scroll avant de centrer l'offset. L'offset initial � z�ro pouvait donc �tre lu comme le premier jour de la fen�tre (J-3) et remplacer la date du jour.
- L'initialisation de la fen�tre et de l'offset est maintenant faite avant d'activer le traitement du d�filement.
- Aucun changement API requis.

## V�rifications
- `npx.cmd eslint 'app/(tabs)/home/index.tsx'` : 0 erreur, 8 avertissements existants.
- Pas de test sur appareil effectu�.

# HANDOFF - Glissement de fen�tre par trois jours (18/11/2026)

## Fait
- La fen�tre de 7 jours avance ou recule maintenant de 3 jours lorsqu'on approche de son bord dans l'accueil. Le d�calage est compens� pour garder le m�me instant visible; les appels API gardent leurs param�tres d�but/fin sur 7 jours.
- Aucun changement API requis.

## V�rifications
- `npx.cmd eslint 'app/(tabs)/home/index.tsx'` : 0 erreur, 8 avertissements existants.
- Pas de test sur appareil effectu�.

# HANDOFF - Libell� du statut compact dans le profil (18/11/2026)

## Fait
- Dans `app/(tabs)/profile/index.tsx`, le libell� du bouton de disponibilit� est visible 5 secondes � chaque focus du profil, puis masqu� pour ne garder que le point color� et la fl�che. Le d�lai est annul� quand on quitte l'�cran.
- Aucun changement API requis.

## V�rifications
- ESLint sur le fichier : m�mes 18 erreurs et 2 avertissements que la version HEAD (probl�mes pr�existants); aucun diagnostic suppl�mentaire.
- Pas de test sur appareil effectu�.

# HANDOFF - Heure d'expiration des invitations dans le fil (18/11/2026)

## Fait
- `components/notificationItem.tsx` convertit maintenant l'expiration UTC envoy�e par l'API vers le fuseau choisi dans les param�tres de l'application avant d'afficher l'heure.
- V�rification en lecture seule de `sync_api` : son format de date d'expiration est un ISO sans offset, interpr�t� comme UTC par l'app. Aucun changement API requis.

## V�rifications
- `npx.cmd eslint components/notificationItem.tsx` : 0 erreur, 3 avertissements pr�existants.
- Pas de test sur appareil effectu�.

# HANDOFF - Blocage directionnel d'un ami (18/11/2026)

## Fait
- Profil ami : bouton Bloquer/D�bloquer, �tat charg� depuis l'API et erreurs affich�es via le catcher.
- `sync_api` : migration `20261119000000_CREATE_blocages.js`, table directionnelle `blocages` (`id_bloqueur`, `id_bloque`), endpoint `PATCH /amis/:idami_publique/blocage`, et refus en 404 de l'acc�s au profil par la personne bloqu�e. Le bloqueur conserve l'acc�s et peut d�bloquer depuis le profil.
- `bd/schema.sql` mis � jour pour les nouvelles installations. La migration n'a pas �t� appliqu�e � une base.

## V�rifications
- ESLint du profil ami : 0 erreur, 1 avertissement pr�existant (`rechargement`). JSON FR/EN valide.
- `node --check` r�ussi sur les deux routes et la migration API. ESLint API non ex�cut� : `npx eslint` est rest� bloqu� sans sortie, commande interrompue.
- Aucun test d'int�gration ni sur appareil effectu�.

# HANDOFF - Restrictions entre membres bloqu�s (18/11/2026)

## Fait
- Les conversations priv�es � deux participants sont masqu�es des listes et recherches des deux membres; le middleware refuse aussi l'ouverture et l'envoi de messages. Un changement de blocage incr�mente le num�ro de version des conversations afin de rafra�chir les listes.
- `verifierAmitieParticipants` refuse les membres bloqu�s dans les cr�ations de conversation et les invitations/cr�ations d'�v�nements.
- `fetchAmis` retire le bloqueur de la liste du membre bloqu� et expose `bloque_par_moi` au bloqueur. Les s�lecteurs d'invit�s, cr�neaux communs et widget de profil tiennent compte de cet �tat.
- Les contr�les `/disponibilites/communes` et `/disponibilites/amis/:idpublique` refusent aussi les paires bloqu�es.

## V�rifications
- `node --check` r�ussi sur 8 fichiers JS de l'API, dont les routes/middlewares modifi�s et la migration.
- ESLint des fichiers app touch�s : 0 erreur; avertissements pr�sents dans le profil ami, eventListAmi et l'accueil.
- `git diff --check` r�ussi dans les deux projets.
- ESLint API non ex�cut� : `npx eslint` reste bloqu� sans sortie dans sync_api. Migration non appliqu�e � la base; aucun test d'int�gration/appareil ex�cut�.
---

## Ajout (21/11/2026) — US 49 : thème choisi avec une roue de couleurs (branche `philip-us49-theme-colorwheel`, depuis main)
- US : la couleur courante dans un cercle ; toucher le cercle → modale avec la roue ; bouger
  la roue → aperçu ; quitter la modale → la couleur s'applique à toute l'app.
- Le thème reste une teinte (0-359) : generateTheme en dérive toutes les couleurs (rôles à
  saturation / luminosité fixes). La roue choisit donc une teinte (anneau), pas une couleur
  libre. User : « vas-y avec la wheel » (pas de couleurs suggérées).
- `functions/couleurTeinte.ts` (nouveau) : `hsl(h, 65%, 55%)`, la couleur qui représente une
  teinte (anneau, curseur, cercle des paramètres).
- `components/roueTeinte.tsx` (nouveau) : anneau SVG de 120 morceaux (mémorisés), curseur
  Reanimated déplacé sur le fil UI, `Gesture.Pan().minDistance(0)` (un tap choisit aussi),
  angle 0° en haut, sens horaire ; `onChange` (scheduleOnRN) seulement quand le degré entier
  change ; centre = couleur choisie ; accessible (adjustable, ± 10°).
- `components/apercuTheme.tsx` (nouveau) : faux écran (fond, carte d'évènement, statut,
  bouton) avec generateTheme(teinte, mode clair/sombre de l'appareil).
- `components/selecteurTheme.tsx` (nouveau) : <Modal> transparent (fond flouté), roue +
  « rétablir la valeur par défaut » (DEFAULT_HUE) + aperçu + Annuler / Terminé. Quitter
  (Terminé, toucher dehors, retour Android) applique ; Annuler ne change rien. Son propre
  GestureHandlerRootView (un Modal est hors de celui de l'app : le geste ne marcherait pas
  sur Android). Pas la modale générique (ModalBase) : son geste de glissement couvre toute
  la feuille et entrerait en conflit avec celui de la roue.
- `types/settings.ts` : type de réglage `color` (value = couleur CSS, onPress) ;
  `components/settingsRow.tsx` : le cercle (36 px). `app/(tabs)/profile/settings/index.tsx` :
  le champ numérique de la teinte (et son TODO « color picker ») remplacé par le cercle ;
  appliquer = `setHue` + `setSetting('theme')` comme avant. Le type `input` n'est plus
  utilisé nulle part (laissé).
- Locales fr/en `settings.themePicker.*`.
- Vérifs : tsc OK, eslint 0 erreur (5 warnings préexistants dans index.tsx / settingsRow /
  types, lignes non touchées), jest 13/13 (main).
- Non testé sur appareil : glisser / toucher la roue (iOS et Android), aperçu qui suit,
  Terminé / toucher dehors / retour Android appliquent, Annuler, valeur par défaut, cercle
  mis à jour, mode sombre.
- Bug hors sujet (non corrigé) : `types/settings.ts:13` `DEFAULT_SETTINGS.theme = 260` mais
  `constants/Colors.ts:4` `DEFAULT_HUE = 274` ; tant que l'user n'a jamais choisi de teinte,
  `contextes/contextePalette.tsx:37` part de `settings.theme` (260), alors que « valeur par
  défaut » remet 274.
- Corrigé ensuite à la demande de l'user (choix : 260, ce que voyait un nouvel user) :
  `constants/Colors.ts` `DEFAULT_HUE = 260` (était 274) et `types/settings.ts`
  `DEFAULT_SETTINGS.theme = DEFAULT_HUE` (une seule valeur). tsc OK, jest 13/13.

---

## Ajout (21/11/2026) — US 50 : changer son mot de passe (app : même branche que la US 49 ; API : `philip/us50-mot-de-passe` depuis main)
- Choix de l'user : app sur la même branche que la US 49 ; signalement d'abus = courriel aux
  admins seulement (pas de déconnexion), lien valide 7 jours, une seule fois.
- **API (`sync_api`, MIGRATION REQUISE)** :
  - `migrations/20261121000000_CREATE_changements_mot_de_passe.js` : (id, id_membre FK
    membres CASCADE, temps_changement, signale, temps_signalement).
  - `PATCH /membres/mot_de_passe` (authentifierToken + `limiteMotDePasse` 10 / 15 min) :
    { ancien, nouveau } → 400 champ manquant ; 403 ancien faux ; nouveau === ancien → 200
    `modifie: false` sans rien faire (ni hash, ni courriel) ; règles (`reglesMotDePasse.js`,
    mêmes que register.tsx : 12 car., spécial, maj + min) → 400 ; sinon hash + UPDATE +
    INSERT changements_mot_de_passe + courriel au membre AVANT le commit (courriel en échec →
    rollback, mot de passe inchangé, 500 explicite) → 200 `modifie: true`.
  - `src/functions/courrielsMotDePasse.js` : courriel au membre (date dans son fuseau, lien
    « signale-le », pseudo échappé) ; courriel aux admins (`membres.role = 'admin'`), objet
    « Abus de Mot de Passe ».
  - `GET /confirmation/abus_mot_de_passe?token` : page de confirmation (confirmation.ejs) —
    un GET seul ne signale rien (scanners de courriels) ; `POST` : signale = 1 (une fois),
    courriel à chaque admin avant le commit (échec → rollback, on peut réessayer).
  - `genConfirmationToken.js` : options `extra` (id_changement) et `expiresIn` (7d) ; défaut
    inchangé (1 h, anonymisation). `authenticate.js` : message d'expiration « 7 jours » pour
    ce lien.
  - **Faille corrigée (dans le sujet)** : `CHAMPS_MODIFIABLES` de `PATCH /membres/profil`
    contenait `mot_de_passe` → n'importe quelle session pouvait changer le mot de passe sans
    l'ancien, et il était enregistré EN CLAIR (pas de hash). Retiré ; l'app ne l'envoyait pas.
  - Vérifs : `node --check` des 8 fichiers ; règles et jetons testés en node (pas de lint
    dans l'API). Pas lancé contre une BD.
- **App** :
  - `app/(modals)/motDePasse.tsx` (nouveau, ModalBase) : actuel / nouveau (règles cochées en
    direct) / confirmation, afficher-masquer ; 403 → toast « mot de passe actuel incorrect » ;
    résultat dans la modale (changé + courriel, ou « tout est beau, rien n'a changé »).
  - `app/(tabs)/profile/edit.tsx` : bouton « changer mon mot de passe » sous la bio ; import
    `useAPI` inutilisé retiré (lint).
  - `functions/reglesMotDePasse.ts` + `tests/reglesMotDePasse.test.js` (5 tests). register.tsx
    garde ses propres règles (non touché).
  - Locales fr/en `profile.password.*`.
  - Vérifs : tsc OK, eslint 0, jest 18/18.
- À faire / tester : lancer la migration ; ancien faux → erreur ; même mot de passe → « rien
  n'a changé » et aucun courriel ; vrai changement → courriel reçu, connexion avec le nouveau ;
  lien « signale-le » → page → bouton → courriel « Abus de Mot de Passe » aux admins ; 2e clic
  → « déjà signalé ». `bd/schema.sql` pas mis à jour (la migration suffit).
## Ajout (18/11/2026) — après une création, retour sur la plage créée
- User : après avoir créé un évènement, l'accueil revenait où il était avant la création
  (il restaure sa position au focus) au lieu de la plage de l'évènement créé.
- `events/creationEvents.ts` (nouveau) : canal « plage créée », même modèle que
  calendrierEvents.
- `components/creationEvenement.tsx` / `creationIndisponibilite.tsx` : la plage envoyée
  est gardée (ref) et annoncée au moment de quitter après une création réussie (201 ou
  écran de conflit « créé ») ; rien si « ajuster mon horaire ».
- `app/(tabs)/home/index.tsx` : `allerALaPlageCreee` — bascule sur le jour créé (fenêtre
  = jour − 3, comme les flèches), centre la plage dans les rangées (son début près de la
  gauche si plus longue que l'écran), et l'enregistre comme position de l'accueil
  (offsetAccueilRef) pour que le focus la remette. Abonnement unique via une ref sur le
  dernier gestionnaire (zoom). Warnings lint préexistants du fichier nettoyés
  (variables inutilisées, `Array<any>`, dépendance `maxY` ; exception justifiée pour
  l'effet de focus).
- Vérifs : eslint 0 erreur / 0 warning sur les 4 fichiers, tsc OK, jest 19/19.
- À savoir : la PR #57 (sync) a été fermée sans fusion le 14/11 avec le commentaire
  « Au refus, une proposition de postpone n'est pas proposé comme mentionné dans la
  US. » ; `main` a avancé depuis (fichiers de création identiques, `timeline.tsx` diffère).

---

## Ajout (18/11/2026) — 2e pull de main (PR #60 à #72 d'Ismail)
- Le 1er pull (d33ee0a) s'est fait sur `main` à d318063 (11 h 20) ; les PR #60–#72 + le
  « temporary fix » ont été fusionnées dans `main` juste après. Fusionnées dans
  `philip-dev-s1` au commit 1d4e31f.
- Conflits résolus :
  - `components/modalBase.js` : main a ajouté `afficherBoutonPleinEcran` (+ `boutonADroite`),
    le même bouton que notre `afficherBoutonFermer` → on garde le nom de main, JSDoc de
    toutes les props ; `app/(modals)/dataRenderer.tsx` passe `afficherBoutonPleinEcran`
    (param `sansBoutonFermer: '1'` inchangé). `afficherBoutonFermer` n'existe plus.
  - `locales/{fr,en}/events.json` : nos clés `postpone.*` + la section `album` de main.
  - `app/(tabs)/home/index.tsx` (travail non commité) : l'effet de focus de main
    (`pauseALaSortie`, `reprendre`) est gardé ; `allerALaPlageCreee` reste compatible
    (chargerFenetre → setParams pendant la pause, le focus relit windowStartRef /
    offsetAccueilRef). `HAUTEUR_RETOUR` (inutilisée) retirée, `AMIS_PAR_PAGE` de main gardé.
- `npm ci` lancé (nouvelles dépendances de main : expo-image, expo-image-manipulator,
  expo-media-library, babel-plugin-react-compiler).
- Vérifs : tsc OK, jest 19/19, eslint 0 sur les 22 fichiers que la branche change vs main
  et sur les fichiers non commités.

---

## Ajout (18/11/2026) — participants : rien n'est envoyé avant le ✓ du formulaire
- Signalé : réinviter un participant qui a quitté « ne fonctionne pas ». Diagnostic (BD de dev) :
  la réinvitation partait bien (invitation 143, participation, notification) — le vrai
  problème était le comportement : « Inviter » envoyait tout de suite, même si la
  modification était ensuite annulée. Nouvelle spécification de l'user (critères) :
  - « Inviter » (modale d'amis) ajoute seulement à une liste en attente du formulaire ;
    les invitations partent au ✓ ; quitter / annuler sans ✓ n'envoie rien.
  - Dans Modifier, le créateur (éditeur) peut retirer n'importe quel participant ; X sur un
    participant existant → confirmation « Êtes-vous sûr ? … fait déjà partie de
    l'évènement. » ; X sur un ajout en attente → retiré tout de suite.
  - Au ✓ : retraits + invitations d'un coup ; un changement de participants seul ne PATCH
    pas l'évènement (pas de notification / réinvitation des autres).
  - Choix de l'user : l'écran Détails devient en lecture seule (ni + ni X). Conséquence
    assumée : un participant non éditeur qui a accepté ne peut plus inviter d'amis (US 8).
- `functions/brouillonInvites.ts` (nouveau, testé par `tests/brouillonInvites.test.js`) :
  règles pures du brouillon { invites, retraits } ; réajouter un participant retiré annule
  le retrait (pas de nouvelle invitation).
- `contextes/contexteInvites.tsx` : n'appelle plus l'API ; `ajouterInvite(amis)`,
  `supprimerInvite(p)` (ajout en attente), `retirerParticipant(p)` (existant),
  `retraits`, `resetInvites` vide les deux.
- `hooks/useFriendList.tsx` / `components/eventListAmi.tsx` : plus de param `inviterUrl` ;
  le bouton de la modale est toujours « Ajouter (n) ».
- `components/participantsListe.tsx` : `peutGererParticipants` = formulaire (création, ou
  Modifier par un éditeur) → + et X ; sinon lecture seule (liste du serveur seulement,
  sans les brouillons). Affiche serveur + ajouts − retraits ; hauteur sans la ligne du +
  en lecture seule.
- `components/participantLigne.tsx` : props `existant` / `onRetirer` (plus d'appel API).
- `components/eventForm.tsx` : `peutGererParticipants = create || (edit && éditeur)`.
- `app/(tabs)/home/edit/[event].tsx` : brouillon vidé à l'ouverture et à la sortie
  ('removed') ; `enregistrer` au ✓ : DELETE des retraits → PATCH si des champs ont changé
  → POST des invitations (avec la nouvelle heure) ; reprise sans risque après un échec
  (DELETE idempotent, l'API ignore les déjà-participants, champs marqués sauvés).
- Locales : `participantRemoval.confirmMessage` (fr/en).
- Limites connues (hors portée) : un participant qui a REFUSÉ reste dans la liste, donc
  absent de la modale — le retirer puis le réajouter annule le retrait au lieu de le
  réinviter. Le brouillon est global (contexte) : ouvrir Modifier vide un brouillon de
  création laissé ouvert dans un autre onglet.
- Vérifs : tsc OK, eslint 0 erreur sur les fichiers modifiés, jest 23/23.

---

## Ajout (18/11/2026) — participants : les ajouts du formulaire listés à part (« à inviter (au ✓) »)
- User : « dès que t'appuies sur Ajouter dans le modal ça ajoute, ça doit être ajouté seulement
  au ✓ ». Vérifié en BD : aucune invitation ni notification créée depuis 19:20 UTC — rien
  n'était envoyé. Mais l'ami choisi apparaissait DANS la liste des participants, avec la même
  icône « en attente » qu'une invitation envoyée : il avait l'air invité.
- `components/participantsListe.tsx` : la liste des participants = celle du serveur (moins les
  retraits) ; les amis choisis sont dans une section à part « à inviter (au ✓) - n » (X =
  retiré tout de suite) ; une note « n participant(s) retiré(s) au ✓ » pour les retraits.
  Même chose en création. Hauteur animée : + titre et lignes de la section, + la note.
- `components/participantLigne.tsx` : prop `aInviter` → pas d'icône de statut (pas encore
  d'invitation).
- Locales `form.toInvite`, `form.removedOnConfirm_one/_other` (fr/en).
- Vérifs : tsc OK, eslint 0 erreur, jest 23/23.

---

## Ajout (18/11/2026) — retouche + nettoyage
- User : enlever le titre « à inviter (au ✓) - n » → les amis choisis restent listés sous les
  participants, au-dessus du +, sans icône de statut (X = retiré tout de suite). La note
  « n participant(s) retiré(s) au ✓ » est gardée. Clé `form.toInvite` retirée (fr/en).
- Nettoyage du code non commité : commentaires à jour (`participantsListe`, `creationEvents`
  — doc déplacée sur `creationEvents`, `creationIndisponibilite`, étapes 1-2-3 de
  `enregistrer` dans Modifier) ; retirés car devenus inutilisés : clé `list.inviteCount`
  (friends fr/en), type `InviterUrl` (`types/invites.ts`). `SupprimerUrl` était déjà
  inutilisé avant : laissé.
- Vérifs : tsc OK, eslint 0 erreur (16 warnings préexistants), jest 23/23.

---

## Ajout (21/11/2026) — au refus d'une invitation : « Aimerais-tu proposer une autre date? »
- Règle la remarque qui a fait fermer la PR #57 (« Au refus, une proposition de postpone
  n'est pas proposée comme mentionné dans la US »).
- Choix de l'user : on refuse d'abord, puis on demande ; choix de la date = seulement date +
  heure (SelecteurReport, durée conservée).
- API : rien à changer. Un invité qui a refusé a déjà `peut_proposer` (statut ≠ acceptee) ;
  si le créateur applique sa proposition, notifierModificationEvenement réinvite tout le
  monde (en attente), lui compris.
- `hooks/useDecisionInvitation.tsx` : après un refus réussi, GET /postpone/evenements/:id ;
  si `peut_proposer` (pas récurrent, pas passé) et l'invitation a ses dates → ouvre la
  modale générique `/(modals)/dataRenderer` (clé `propositionApresRefus`, titre
  « Invitation refusée », sans bouton rond) ; sinon toast du refus comme avant. Le GET se
  fait AVANT `onRepondu` (fil rafraîchi / POP_TO_TOP) : l'écran dessous et la modale
  changent ensemble. Pas de toast de refus quand la modale s'ouvre (son titre le dit).
  - Pourquoi une route et pas un <Modal> dans la carte : le fil se recharge toutes les 5 s
    et retire les invitations refusées (list.tsx `estInvitationRefusee`) → la carte (et un
    Modal rendu dedans) disparaît ; la page de décision, elle, revient à l'accueil.
- `components/propositionApresRefus.tsx` (nouveau) : étapes question (Proposer une autre
  date / Non merci) → choix (SelecteurReport `toujoursOuvert`, Annuler) → envoyée (✓ +
  OK). Fermeture : `modalEvents.emitClosing()` ; glisser vers le bas / toucher dehors = non.
- `hooks/useReportEvenement.ts` : `envoyerCreneau(creneau, { annoncer: false })` = pas de
  toast de succès (le toast de la modale disparaîtrait avec sa route ; l'étape « envoyée »
  le dit). Défaut inchangé pour les autres appels.
- `components/selecteurReport.tsx` : prop `toujoursOuvert` (pas de rangée titre/chevron).
- Locales fr/en `invitationDecision.*` : refusedTitle, proposeQuestion, proposeHint,
  proposeYes, proposeNo, done.
- Vérifs : eslint 0 sur les 4 fichiers, tsc OK, jest 23/23.
- Non testé sur appareil : refuser depuis la carte du fil ET depuis la page de décision
  (la modale doit rester ouverte quand la carte disparaît / quand la page revient à
  l'accueil), sélecteurs natifs dans la feuille (iOS compact, dialogues Android), envoi →
  étape « envoyée », Non merci, évènement récurrent (pas de question, toast du refus).

## Résolution de conflits après pull main (24/11/2026)
- Les conflits du journal, de l'accueil et du profil ont été résolus en gardant les changements des deux branches.
- L'accueil conserve le glissement de fenêtre par 3 jours et reprend les rafraîchissements en pause. Le profil conserve le bouton de statut compact, avec transition ressort basée sur `withSpringConfig`; la photo continue d'utiliser `PfpWithAvailability`.
- `npm ci` n'a pas terminé : accès EACCES au registre npm sur `zxing-wasm`.
- Verification après synchronisation des dépendances : `npm ci` réussi; `npm run typecheck` passe; ESLint passe sur les deux écrans fusionnés et `components/albumEvenement.tsx`. Le chemin d'album avait un type Expo généré en retard; navigation conservée via Href après vérification que la route existe.

## Animation du libellé de disponibilité (24/11/2026)
- `app/(tabs)/profile/index.tsx` : le libellé du bouton utilise maintenant `Animated.Text` avec `FadeOut` (150 ms) et `FadeIn` (200 ms). Le conteneur conserve `LinearTransition` configuré avec `withSpringConfig` pour animer sa largeur. Délai et réaffichage au focus inchangés.
- ESLint et typecheck passent.

## Alertes de rappel d'evenement (24/11/2026)
- L'app propose deux moments de rappel (debut/fin), selectionnes par defaut a la creation, reglables dans le formulaire d'edition et ajoutables dans la carte de details (editeurs).
- L'API synchronise les alertes pour les participants, renvoie les moments dans GET /evenements/:id et accepte PATCH /evenements/:id/alertes. Le cron `envoyer_rappels_evenement` envoie une push et cree une notification de fil; les rappels recurrent sont reprogrammes a l'occurrence suivante.
- Migration requise : `20261124120000_ADD_moments_alertes.js`. Verification : typecheck app OK, ESLint 0 erreur (13 avertissements preexistants sur les ecrans form/details), `node --check` OK sur les fichiers serveur modifies. Aucun test ni essai appareil fait.
