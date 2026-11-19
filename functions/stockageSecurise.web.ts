/**
 * Version web de `stockageSecurise.ts`. expo-secure-store n'existe pas sur le web
 * (son module natif y est un objet vide, chaque appel lève une TypeError), donc on
 * se rabat sur localStorage. Pas chiffré : ça sert au dev et aux tests dans le navigateur.
 */

const stockage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // stockage bloqué (navigation privée, cookies désactivés…)
  }
};

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return stockage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    stockage()?.setItem(key, value);
  } catch {
    // stockage plein ou bloqué : le token ne survivra pas au rechargement, rien de plus
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    stockage()?.removeItem(key);
  } catch {
    // rien à faire
  }
}
