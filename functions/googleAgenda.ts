import type { AxiosInstance } from 'axios';

import type { CalendrierImport, CompteImport, ReponseCalendriers } from '@/functions/imports';
import { extraireProgression, modifierPreferencesCalendrier, suivreImport } from '@/functions/imports';

import { PlatformOAuth } from '@/types/calendar';

// Outil partagé Google / Outlook : types, suivi d'import, modification de préférences.
export type {
    CalendrierImport, CompteImport, JobImport,
    ProgressionImport, ReponseCalendriers, StatutCompte,
    StatutImport
} from '@/functions/imports';
export { extraireProgression, modifierPreferencesCalendrier, suivreImport };
    

/** Statut d'un compte Google lié au membre. */
export type CompteGoogle = CompteImport;

/** Un calendrier Google proposé à l'utilisateur. */
export type CalendrierGoogle = CalendrierImport & { source: 'google' };

/** La réponse de GET /calendriers/google. */
export type ReponseCalendriersGoogle = ReponseCalendriers;




/** La configuration OAuth publique, servie par l'API. */
export type ConfigOAuthGoogle = {
    client_id: string;
    redirect_uri: string | null;
    scopes: string[];
    plateforme?: string;
};

/** Récupère la configuration OAuth publique (client_id, redirect_uri, portées). */
export async function chargerConfigGoogle(
    api: AxiosInstance,
    platform?: PlatformOAuth,
): Promise<ConfigOAuthGoogle> {
    const { data } = await api.get<ConfigOAuthGoogle>('/comptes/google/config', {
        params: platform ? { platform: platform } : undefined,
    });
    return data;
}

/** Liste les comptes Google liés au membre. */
export async function chargerComptesGoogle(api: AxiosInstance): Promise<CompteGoogle[]> {
    const { data } = await api.get<{ comptes: CompteGoogle[] }>('/comptes/', { params: { fournisseur: 'google' } });
    return data.comptes ?? [];
}

/** Liste les comptes et les calendriers Google du membre. */
export async function chargerCalendriersGoogle(api: AxiosInstance): Promise<ReponseCalendriersGoogle & { calendriers: CalendrierGoogle[] }> {
    const { data } = await api.get<ReponseCalendriersGoogle & { calendriers: CalendrierGoogle[] }>('/calendriers/google');
    return data;
}

/**
 * Envoie la sélection de calendriers. L'action est idempotent : le tableau reçu
 * fait foi, un calendrier absent est désactivé (ses événements sont marqués
 * `deleted_at`, pas effacés).
 * @returns l'identifiant du job d'import (null si rien n'était à importer) et le
 * nombre de calendriers retirés.
 */
export async function selectionnerCalendriersGoogle(
    api: AxiosInstance,
    idsExternes: string[],
): Promise<{ jobId: string | null; calendriersDesactives: number }> {
    const { data } = await api.put<{ job_id: string | null; calendriers_desactives?: number }>(
        '/calendriers/google',
        { calendar_ids: idsExternes },
    );
    return { jobId: data.job_id ?? null, calendriersDesactives: data.calendriers_desactives ?? 0 };
}

export async function modifierCalendriersGoogle(
    api: AxiosInstance,
    idPublique: string,
    modifications: Partial<CalendrierGoogle>,
): Promise<void> {
    await modifierPreferencesCalendrier(api, idPublique, modifications);
}

/** Relance l'import d'un calendrier déjà sélectionné. */
export async function resynchroniserCalendrierGoogle(api: AxiosInstance, idPublique: string): Promise<string> {
    const { data } = await api.post<{ job_id: string }>(`/calendriers/syncroniser/${idPublique}`);
    return data.job_id;
}

/** Déconnecte un compte Google : ses calendriers sont désactivés et ses événements retirés. */
export async function deconnecterCompteGoogle(api: AxiosInstance, idPublique: string): Promise<void> {
    await api.post(`/comptes/deconnexion/${idPublique}`);
}

/**
 * Envoie le code d'autorisation à l'API, qui l'échange contre les jetons Google.
 *
 * Le `client_id` est renvoyé avec le code : l'API en déduit le client_secret
 * correspondant (le code et le refresh_token sont liés au client qui les a
 * obtenus). Le secret ne transite jamais par l'app.
 */
export async function connecterCompteGoogle(
    api: AxiosInstance,
    code: string,
    codeVerifier?: string,
    clientId?: string,
): Promise<void> {
    await api.post('/comptes/google/connexion', {
        server_auth_code: code,
        code_verifier: codeVerifier,
        client_id: clientId,
    });
}

/** Alias : le suivi d'import est fourni par l'outil partagé. */
export const suivreImportGoogle = suivreImport;
