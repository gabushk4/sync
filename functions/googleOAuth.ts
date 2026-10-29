import * as AuthSession from 'expo-auth-session';

import { ConfigurationOAuthInvalide, demanderCodeOAuth, type CodeAutorisation } from '@/functions/oauth';
import type { ConfigOAuthGoogle } from '@/functions/googleAgenda';

// ré-exports : les écrans et tests importent le code / l'erreur depuis ce module
export type { CodeAutorisation } from '@/functions/oauth';
export { ConfigurationOAuthInvalide } from '@/functions/oauth';

/** L'émetteur d'autorisation Google (découverte complète via le .well-known). */
const ISSUER_GOOGLE = 'https://accounts.google.com';

/**
 * Lance le consentement Google et renvoie le code d'autorisation.
 *
 * Le flux est celui de l'outil partagé (`demanderCodeOAuth`) ; seul le fournisseur
 * et la découverte diffèrent :
 *  - Google : découverte complète via l'émetteur (`accounts.google.com`);
 *  - Microsoft : document de découverte partiel `{ authorizationEndpoint }`,
 *    fourni par l'API (source de vérité).
 *
 * L'app n'a qu'un rôle : obtenir le code. C'est l'API qui détient le client_secret,
 * échange le code contre les jetons et chiffre le refresh token. L'app ne voit donc
 * jamais de secret — seulement un code à usage unique.
 *
 * @returns le code, ou null si l'utilisateur a fermé la fenêtre sans valider.
 * @throws ConfigurationOAuthInvalide si la configuration servie par l'API est incomplète.
 * @throws Error si Google refuse l'autorisation.
 * @author Gabriel Pereira Levesque US-19 — import Google Agenda
 */
export async function demanderCodeGoogle(config: ConfigOAuthGoogle): Promise<CodeAutorisation | null> {
    if (!config?.client_id) {
        throw new ConfigurationOAuthInvalide('identifiant client OAuth manquant');
    }
    if (!config?.redirect_uri) {
        throw new ConfigurationOAuthInvalide('URI de redirection OAuth manquante');
    }
    if (!config?.scopes?.length) {
        throw new ConfigurationOAuthInvalide('portées OAuth manquantes');
    }

    // Découverte complète via l'émetteur.
    const discovery = await AuthSession.resolveDiscoveryAsync(ISSUER_GOOGLE);

    // hors ligne + consentement forcé : c'est ce qui fait que Google renvoie un
    // refresh_token (donc un import durable côté Sync).
    const code = await demanderCodeOAuth({
        clientId: config.client_id,
        redirectUri: config.redirect_uri,
        scopes: config.scopes,
        discovery,
        responseType: AuthSession.ResponseType.Code,
        extraParams: { access_type: 'offline', prompt: 'consent' },
        messageSansCode: "Google n'a pas renvoyé de code d'autorisation",
    });

    // `demanderCodeOAuth` renvoie `null` si l'utilisateur annule : on le propage.
    return code;
}
