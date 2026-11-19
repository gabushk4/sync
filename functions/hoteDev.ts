import Constants from 'expo-constants';

/**
 * Host de la machine de dev qui sert le bundle, ex. "192.168.1.42:8081".
 * Sur mobile, le serveur Metro l'ajoute au manifest qu'il envoie au dev client.
 * Absent dans un build de prod. Sur le web, Metro prend `hoteDev.web.ts` à la place.
 */
export function hoteDev(): string | undefined {
  return Constants.expoConfig?.hostUri ?? undefined;
}
