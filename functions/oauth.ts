import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Outil partagé du flux OAuth (Google / Microsoft / Outlook…).
 *
 * Cohérence avec les modules fournisseur (`googleOAuth.ts`, `outlookOAuth.ts`) :
 *  - l'app n'a qu'un rôle : obtenir le code d'autorisation ;
 *  - l'API détient le client_secret, échange le code contre les jetons et chiffre le refresh token ;
 *  - l'app ne voit donc que client_id / redirect_uri / portées + le code.
 *
 * La seule différence de fond entre fournisseurs reste la *découverte* :
 *  - Google : découverte complète via l'émetteur (`accounts.google.com`);
 *  - Microsoft : document de découverte partiel (`{ authorizationEndpoint }`),
 *    car l'API ne fournit que l'URL d'autorisation.
 */

/** Le code d'autorisation et son vérificateur PKCE. */
export type CodeAutorisation = {
    code: string;
    code_verifier?: string;
};

/** Levée quand l'API n'expose pas une configuration OAuth exploitable. */
export class ConfigurationOAuthInvalide extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigurationOAuthInvalide';
    }
}

export type ParametresOAuth = {
    /** Identifiant client OAuth fourni par l'API. */
    clientId: string;
    /** URI de redirection fournie par l'API. */
    redirectUri: string;
    /** Portées OAuth demandées (ex. ['calendar'] ou scopes Microsoft). */
    scopes?: string[];
    /** Découverte : document complet (Google) ou partiel `{ authorizationEndpoint }` (Microsoft). */
    discovery: AuthSession.AuthDiscoveryDocument;
    /** Type de code OAuth demandé. */
    responseType?: AuthSession.ResponseType | string;
    /** Instructions de consentement / ré-authentification. */
    prompt?: AuthSession.Prompt | AuthSession.Prompt[];
    /** Paramètres additionnels de la requête (ex. `access_type: 'offline'` pour Google). */
    extraParams?: Record<string, string>;
    /** Message utilisé si le fournisseur n'a pas renvoyé de code. */
    messageSansCode?: string;
};

/**
 * Lance le flux d'autorisation OAuth générique et renvoie le code.
 *
 * @returns le code, ou null si l'utilisateur a fermé la fenêtre sans valider.
 * @throws ConfigurationOAuthInvalide si les paramètres côté app sont incomplets.
 * @throws Error si le fournisseur refuse l'autorisation.
 */
export async function demanderCodeOAuth(params: ParametresOAuth): Promise<CodeAutorisation | null> {
    const { clientId, redirectUri, scopes } = params;

    if (!clientId) {
        throw new ConfigurationOAuthInvalide('identifiant client OAuth manquant');
    }
    if (!redirectUri) {
        throw new ConfigurationOAuthInvalide('URI de redirection OAuth manquante');
    }
    if (!scopes?.length) {
        throw new ConfigurationOAuthInvalide('portées OAuth manquantes');
    }

    // Sur le web, la fenêtre d'autorisation doit être explicitement refermée.
    if (Platform.OS === 'web') {
        WebBrowser.maybeCompleteAuthSession();
    }

    const request = await AuthSession.loadAsync(
        {
            clientId,
            redirectUri,
            scopes,
            ...(params.responseType ? { responseType: params.responseType } : {}),
            ...(params.prompt ? { prompt: params.prompt } : {}),
            ...(params.extraParams ? { extraParams: params.extraParams } : {}),
        },
        params.discovery,
    );

    const resultat = await request.promptAsync(params.discovery);

    if (resultat.type !== 'success') {
        if (resultat.type === 'error') {
            throw new Error(resultat.error?.message ?? params.messageSansCode ?? 'autorisation refusée');
        }
        return null; // annulé ou fenêtre fermée
    }

    const code = resultat.params?.code;
    if (!code) {
        throw new Error(params.messageSansCode ?? 'le fournisseur n’a pas renvoyé de code d’autorisation');
    }

    return { code, code_verifier: request.codeVerifier };
}
