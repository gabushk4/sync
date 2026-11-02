import * as AuthSession from 'expo-auth-session';

import { ConfigurationOAuthInvalide, demanderCodeOAuth, type CodeAutorisation } from '@/functions/oauth';
import type { ConfigOAuthOutlook } from '@/functions/outlookAgenda';

// ré-exports : les écrans et tests importent le code / l'erreur depuis ce module
export type { CodeAutorisation } from '@/functions/oauth';
export { ConfigurationOAuthInvalide } from '@/functions/oauth';

/**
 * Lance le flux d'autorisation Microsoft (OAuth 2.0 / OIDC) et renvoie le code.
 *
 * Le flux est celui de l'outil partagé (`demanderCodeOAuth`) ; seul le fournisseur
 * et la découverte diffèrent :
 *  - Microsoft : document de découverte partiel `{ authorizationEndpoint }`, fourni
 *    par l'API (source de vérité) ;
 *  - Google : découverte complète via l'émetteur (`accounts.google.com`).
 *
 * Le consentement est forcé (`prompt: Consent`) pour obtenir un refresh token durable.
 *
 * L'app n'a qu'un rôle : obtenir le code. C'est l'API qui détient le client_secret,
 * échange le code contre les jetons Microsoft et chiffre le refresh token. L'app ne
 * voit donc jamais de secret — seulement un code à usage unique.
 *
 * @returns le code, ou null si l'utilisateur a fermé la fenêtre sans valider.
 * @throws ConfigurationOAuthInvalide si la configuration servie par l'API est incomplète.
 * @throws Error si Microsoft refuse l'autorisation.
 * @author Gabriel Pereira Levesque US-19 — import Outlook
 */
export async function demanderCodeOutlook(config: ConfigOAuthOutlook): Promise<CodeAutorisation | null> {
    if (!config?.client_id) {
        throw new ConfigurationOAuthInvalide('identifiant client OAuth manquant');
    }
    if (!config?.redirect_uri) {
        throw new ConfigurationOAuthInvalide('URI de redirection OAuth manquante');
    }
    if (!config?.scopes?.length) {
        throw new ConfigurationOAuthInvalide('portées OAuth manquantes');
    }

    // Document de découverte partiel fourni par l'API (source de vérité).
    const discovery = { authorizationEndpoint: config.authorize_url };

    const code = await demanderCodeOAuth({
        clientId: config.client_id,
        redirectUri: config.redirect_uri,
        scopes: config.scopes,
        discovery,
        prompt: AuthSession.Prompt.Consent,
        messageSansCode: "Microsoft n'a pas renvoyé de code d'autorisation",
    });

    // `demanderCodeOAuth` renvoie `null` si l'utilisateur annule : on le propage.
    return code;
}
