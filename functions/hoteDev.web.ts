/**
 * Version web de `hoteDev.ts`. Sur le web, le manifest vient de app.json tel quel
 * (pas de hostUri), mais la page est servie par Metro : son host EST la machine de dev.
 * `window` n'existe pas pendant le rendu statique (Node), d'où le test.
 */
export function hoteDev(): string | undefined {
  return typeof window !== 'undefined' ? window.location.host : undefined;
}
