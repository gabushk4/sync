import type { AxiosInstance } from 'axios';

import { suivreImport } from '@/functions/imports';
import type { CalendrierImport, CompteImport, ProgressionImport, ReponseCalendriers } from '@/functions/imports';

// Outil partagé Google / Outlook : types, suivi d'import, modification de préférences.
export { extraireProgression, modifierPreferencesCalendrier, suivreImport } from '@/functions/imports';
export type {
    StatutCompte,
    StatutImport,
    JobImport,
    ProgressionImport,
    CompteImport,
    CalendrierImport,
    ReponseCalendriers,
} from '@/functions/imports';

/** Statut d'un compte Outlook lié au membre. */
export type CompteOutlook = CompteImport;

/** Un calendrier Outlook proposé à l'utilisateur. */
export type CalendrierOutlook = CalendrierImport & { source: 'outlook' };

/** La réponse de GET /calendriers/outlook. */
export type ReponseCalendriersOutlook = ReponseCalendriers;

/** Configuration OAuth publique du fournisseur Outlook, servie par l'API. */
export type ConfigOAuthOutlook = {
    client_id: string;
    redirect_uri: string | null;
    scopes: string[];
    authority: string;
    authorize_url: string;
};

/** Configuration OAuth publique (client_id, redirect_uri, portées) fournie par l'API. */
export async function chargerConfigOutlook(api: AxiosInstance): Promise<ConfigOAuthOutlook> {
    const { data } = await api.get<ConfigOAuthOutlook>('/comptes/outlook/config');
    return data;
}

/** Liste les comptes Outlook liés au membre. */
export async function chargerComptesOutlook(api: AxiosInstance): Promise<CompteOutlook[]> {
    const { data } = await api.get<{ comptes: CompteOutlook[] }>('/comptes/', { params: { fournisseur: 'outlook' } });
    return data.comptes ?? [];
}

/** Liste les comptes et les calendriers Outlook du membre. */
export async function chargerCalendriersOutlook(api: AxiosInstance): Promise<ReponseCalendriersOutlook> {
    const { data } = await api.get<ReponseCalendriersOutlook>('/calendriers/outlook');
    return data;
}

/**
 * Envoie la sélection de calendriers. L'action est idempotent : le tableau reçu
 * fait foi, un calendrier absent est désactivé (ses événements sont marqués
 * `deleted_at`, pas effacés).
 * @returns l'identifiant du job d'import (null si rien n'était à importer) et le
 * nombre de calendriers retirés.
 */
export async function selectionnerCalendriersOutlook(
    api: AxiosInstance,
    idsExternes: string[],
): Promise<{ jobId: string | null; calendriersDesactives: number }> {
    const { data } = await api.put<{ job_id: string | null; calendriers_desactives?: number }>(
        '/calendriers/outlook',
        { calendar_ids: idsExternes },
    );
    return { jobId: data.job_id ?? null, calendriersDesactives: data.calendriers_desactives ?? 0 };
}

/** Relance l'import d'un calendrier déjà sélectionné. */
export async function resynchroniserCalendrierOutlook(api: AxiosInstance, idPublique: string): Promise<string> {
    const { data } = await api.post<{ job_id: string }>(`/calendriers/syncroniser/${idPublique}`);
    return data.job_id;
}

/** Déconnecte un compte Outlook : ses calendriers sont désactivés et ses événements retirés. */
export async function deconnecterCompteOutlook(api: AxiosInstance, idPublique: string): Promise<void> {
    await api.post(`/comptes/deconnexion/${idPublique}`);
}

/**
 * Envoie le code d'autorisation à l'API, qui l'échange contre les jetons Microsoft.
 *
 * Le code est lié au client qui l'a émis : l'API en déduit le client_secret
 * correspondant. Le secret ne transite jamais par l'app.
 */
export async function connecterCompteOutlook(api: AxiosInstance, code: string, codeVerifier?: string): Promise<void> {
    await api.post('/comptes/outlook/connexion', {
        code,
        code_verifier: codeVerifier,
    });
}

/**
 * Suit un import en temps réel et appelle `onFin` une seule fois.
 *
 * Le suivi est fourni par l'outil partagé (SSE + repli polling).
 *
 * @returns une fonction d'annulation (à appeler au démontage de l'écran).
 */
export function suivreImportOutlook(
    api: AxiosInstance,
    jobId: string,
    handlers: {
        onProgression: (progression: ProgressionImport) => void;
        onFin: (progression: ProgressionImport) => void;
    },
): () => void {
    return suivreImport(api, jobId, handlers);
}
