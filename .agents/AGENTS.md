# Règles de travail — `.agents`

## Décisions architecturales (obligatoire)

- **Lire `docs/DECISIONS.md`** avant toute modification ou ajout de fonctionnalité. Les décisions y sont consignées avec contexte, décision et fichiers impactés.
- Toute nouvelle décision technique doit faire l'objet d'une entrée datée (`YYYY-MM-DD`) dans `docs/DECISIONS.md`.

## Couleurs et polices (obligatoire)

- **Interdit** d'utiliser des couleurs codées en dur (ex: `#6366f1`, `#10b981`, `#e2e8f0`, `#ffffff`, etc.) dans un composant.
- Utiliser **`usePalette()`** depuis `@/contextes/contextePalette` pour toutes les couleurs de composants, textes, fonds, bordures, boutons, etc.
- Utiliser **`useFont()`** depuis `@/contextes/contexteFont` pour toutes les familles de polices (ex: `fonts.title`, `fonts.body`).
- Les couleurs disponibles dans `colors` : `primary`, `secondary`, `background`, `card`, `text`, `border`, `error`, `success`, `muted`, `warning`, `disponible`, `indisponible`, `groupe`, `or`, `notification`.

Exemple :
```tsx
const { colors } = usePalette();
const { fonts } = useFont();

// ✅ Correct
<View style={{ backgroundColor: colors.card }} />
<Text style={{ color: colors.text, fontFamily: fonts.title }} />

// ❌ Interdit
<View style={{ backgroundColor: '#6366f1' }} />
<Text style={{ color: '#ffffff' }} />
```
