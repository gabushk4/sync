import type { AxiosInstance } from 'axios';

import { getToken } from '@/functions/tokenStore';

/**
 * Outil partagé des intégrations de calendriers externes (Google / Outlook).
 *
 * C'est le "single tool" du domaine : tout ce qui est fournisseur-agnostique
 * vit ici, et les modules `googleAgenda` / `outlookAgenda` ne gardent que le
 * spécifique de chaque fournisseur (config OAuth, appels de connexion, …).
 *
 * Couvre :
 *  - les types partagés (comptes, calendriers, progression d'import) ;
 *  - le suivi d'import en temps réel (SSE + repli polling) ;
 *  - la modification des préférences d'un calendrier (endpoint unifié).
 */

/** Statuts possibles d'un compte externe. */
export type StatutCompte = 'actif' | 'deconnecte' | 'erreur';

/** Statut d'un groupe d'import. */
export type StatutImport = 'en_cours' | 'termine' | 'erreur';

/** Un import de calendrier (un job = un calendrier). */
export type JobImport = {
    id: string;
    groupId: string;
    lane: string;
    /** nom du calendrier, pour afficher la progression par calendrier */
    label: string | null;
    done: boolean;
    success: boolean | null;
    error: string | null;
};

/** La progression d'un groupe d'import. */
export type ProgressionImport = {
    groupId: string;
    total: number;
    done: number;
    statut: StatutImport;
    jobs: JobImport[];
};

/** Un compte externe (Google ou Outlook) lié au membre. */
export type CompteImport = {
    id: string;
    fournisseur: string;
    id_externe: string;
    courriel: string | null;
    statut: StatutCompte;
    temps_creation: string;
    derniere_erreur: string | null;
    /** vrai quand l'utilisateur doit reconnecter son compte (jeton révoqué, déconnecté…) */
    a_reconnecter: boolean;
};

/** Un calendrier (Google ou Outlook) proposé à l'utilisateur. */
export type CalendrierImport = {
    source: 'google' | 'outlook';
    /** identifiant public du compte propriétaire */
    id_compte: string;
    /** identifiant natif du calendrier chez le fournisseur : à renvoyer tel quel au PUT */
    id_externe: string;
    /** identifiant public Sync du calendrier, null tant qu'il n'est pas sélectionné */
    id_publique: string | null;
    nom: string;
    couleur: number | null;
    /** déjà importé dans Sync */
    actif: boolean;
    /** calendrier principal du compte, proposé par défaut */
    suggere: boolean;
    /** false quand le calendrier est déjà lié à un autre compte */
    disponible: boolean;
    lie_a_autre_compte: boolean;
    derniere_synchro: string | null;
};

/** La réponse de GET /calendriers/google et GET /calendriers/outlook. */
export type ReponseCalendriers = {
    comptes: { id: string; courriel: string | null; statut: StatutCompte; a_reconnecter: boolean }[];
    calendriers: CalendrierImport[];
    comptes_en_erreur: string[];
};

/**
 * Extrait les objets de progression des blocs SSE reçus.
 * Le serveur envoie `event: status` puis `data: {…}` ; les lignes de commentaire
 * (`: keep-alive`) sont ignorées.
 */
export function extraireProgression(bloc: string): ProgressionImport[] {
    const progressions: ProgressionImport[] = [];
    for (const evenement of bloc.split('\n\n')) {
        const ligne = evenement.split('\n').find(l => l.startsWith('data:'));
        if (!ligne) continue;
        try {
            progressions.push(JSON.parse(ligne.slice('data:'.length).trim()) as ProgressionImport);
        } catch {
            // bloc tronqué ou commentaire : on l'ignore
        }
    }
    return progressions;
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ouvre le flux SSE de suivi d'import.
 *
 * React Native ne fournit pas de `Response.body` (le polyfill de `fetch` passe par
 * XMLHttpRequest et n'expose pas de flux) : on lit `xhr.responseText` au fil
 * de l'eau via `onprogress`.
 */
function ouvrirFluxSse(
    url: string,
    surProgression: (progression: ProgressionImport) => void,
    surEchec: () => void,
): XMLHttpRequest {
    const xhr = new XMLHttpRequest();
    let consomme = 0;

    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onprogress = () => {
        if (xhr.status >= 400) {
            surEchec();
            return;
        }
        const texte = xhr.responseText ?? '';
        if (texte.length <= consomme) return;
        // on ne traite que les blocs complets (terminés par une ligne vide)
        const fin = texte.lastIndexOf('\n\n');
        if (fin === -1) return;
        const bloc = texte.slice(consomme, fin + 2);
        consomme = fin + 2;
        for (const progression of extraireProgression(bloc)) surProgression(progression);
    };

    xhr.onerror = () => surEchec();
    xhr.onabort = () => { /* annulation volontaire */ };
    xhr.onload = () => {
        // le flux se termine quand l'import est terminé : s'il se ferme avant
        // l'événement final, le repli polling prend le relais (sinon l'écran
        // resterait bloqué sur « en cours »).
        surEchec();
    };

    xhr.send();
    return xhr;
}

/**
 * Suit un import en temps réel et appelle `onFin` une seule fois.
 *
 * @returns une fonction d'annulation (à appeler au démontage de l'écran).
 */
export function suivreImport(
    api: AxiosInstance,
    jobId: string,
    handlers: {
        onProgression: (progression: ProgressionImport) => void;
        onFin: (progression: ProgressionImport) => void;
    },
): () => void {
    let annule = false;
    let repliLance = false;
    let xhr: XMLHttpRequest | null = null;

    const finir = (progression: ProgressionImport) => {
        if (annule) return;
        annule = true;
        handlers.onFin(progression);
    };

    const traiter = (progression: ProgressionImport) => {
        if (annule) return;
        handlers.onProgression(progression);
        if (progression.statut && progression.statut !== 'en_cours') finir(progression);
    };

    /** Repli : on interroge l'API toutes les 2 secondes. */
    const suivreParPolling = async () => {
        while (!annule) {
            try {
                const { data } = await api.get<ProgressionImport>(`/calendriers/imports/${jobId}`);
                traiter(data);
            } catch {
                // le job a disparu (serveur redémarré) : on ne peut plus suivre
                finir({ groupId: jobId, total: 0, done: 0, statut: 'erreur', jobs: [] });
                return;
            }
            if (annule) return;
            await pause(2000);
        }
    };

    /** Bascule sur le polling, une seule fois. */
    const basculerSurPolling = () => {
        if (annule || repliLance) return;
        repliLance = true;
        void suivreParPolling();
    };

    // Sans jeton en mémoire, le flux SSE ne peut pas être authentifié : on part
    // directement sur le polling, dont l'appel axios rafraîchit le jeton si besoin.
    if (!getToken()) {
        basculerSurPolling();
    } else {
        const base = api.defaults.baseURL ?? '';
        xhr = ouvrirFluxSse(
            `${base}/calendriers/imports/${jobId}/events`,
            traiter,
            basculerSurPolling,
        );
    }

    return () => {
        annule = true;
        xhr?.abort();
    };
}

/**
 * Modifie les préférences (nom, couleur) d'un calendrier, quel que soit le
 * fournisseur d'origine (google / outlook) — endpoint unifié.
 */
export async function modifierPreferencesCalendrier(
    api: AxiosInstance,
    idPublique: string,
    modifications: { nom?: string; couleur?: number | null },
): Promise<void> {
    await api.patch(`/calendriers/preferences/${idPublique}`, modifications);
}
