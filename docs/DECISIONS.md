# Architecture & Engineering Decisions

## YYYY-MM-DD — Initial Stack Setup (**Template**)
- **Context:** Setting up Expo mobile client + Node.js backend.
- **Decision:** Use Expo Router, TypeScript strict mode, and Zod validation.
- **Consequences:** Shared types live in `/packages/shared` (or `/types`).

## 2026-11-19 - Le passage de la date courante au formulaire de création d'évènement
- **Context:** En appuyant sur le FAB + de la home page on tombe sur le formulaire de création d'évènement et la date courante affichée y est passée. Cependant, si on visualise une date antérieure a la date d'aujourd'hui, il nous ait renvoyé une erreur comme quoi on ne peut créer dans le passé.
- **Decision:** La date minimale acceptée devrait être la date d'aujourdhui a l'heure du touché sur le + avec une heure additionné. Ainsi, si on lui passe une date antérieure, le formulaire change pour une date valide ; étant la date d'aujourd'hui à une heure plus tard que l'heure de l'horloge système.
- **Conséquence:** Si l'usager visualise une date considérée comme étant dans le passé, le formulaire d'ajout doit être au courant de l'heure présente. Il doit alors valider et gérer le input depuis un localSearchParams. 

## 2026-11-20 - Animation du tutoriel
- **Contexte :** Les changements d'étape déplaçaient immédiatement la bulle et la découpe SVG du spotlight ne suivait pas ses valeurs Reanimated.
- **Décision :** Animer les coordonnées de la bulle avec Reanimated, piloter les attributs du masque SVG avec `useAnimatedProps`, et appliquer un fondu entrant/sortant au texte lors du changement d'explication.
- **Fichiers impactés :** `components/TutorielEcran.tsx`, `components/spotlightOverlay.tsx`.

## 2026-11-20 - Suppression des animations de position inter-page du tutoriel
- **Contexte :** Lors d'un changement de route, la cible du spotlight et la bulle peuvent se retrouver à une autre position sans que le déplacement entre les deux pages soit souhaitable.
- **Décision :** Utiliser le `pathname` Expo Router comme frontière d'animation : repositionner la bulle immédiatement, et remonter le spotlight à chaque changement de route. Conserver les animations lorsque la route reste la même.
- **Fichiers impactés :** `components/TutorielEcran.tsx`.

## 2026-11-20 - Animations limitées aux explications d'une même étape
- **Contexte :** Le tutoriel change d'écran à chaque étape ; une mesure tardive de la cible pouvait encore déplacer la bulle pendant la transition de page.
- **Décision :** N'animer les positions que lorsque l'index d'explication change sans changement de route ni d'étape. Appliquer directement les nouvelles positions pour les changements d'étape, de route et les mesures.
- **Fichiers impactés :** `components/TutorielEcran.tsx`, `components/spotlightOverlay.tsx`.
