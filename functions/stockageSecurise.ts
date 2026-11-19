/**
 * Stockage des tokens. Sur mobile, c'est expo-secure-store (Keychain / Keystore).
 * Sur le web, Metro prend `stockageSecurise.web.ts` à la place, parce que
 * expo-secure-store n'a pas d'implémentation web.
 */
export { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
