import type { AxiosInstance } from 'axios';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ToastAbs from '@/abstractions/toastAbs';
import { toastTypes } from '@/constants/toastConfig';
import catcher from '@/functions/catcher';
import type { CalendrierImport, CompteImport, ProgressionImport } from '@/functions/imports';
import { suivreImport } from '@/functions/imports';

/**
 * Outil partagé des écrans Google / Outlook — gestion du cycle de vie d'un
 * calendrier externe importé :
 *  - chargement des comptes + calendriers ;
 *  - sélection (cocher / tout cocher / enregistrer) ;
 *  - suivi de l'import (SSE + repli polling) ;
 *  - resynchronisation d'un calendrier ;
 *  - déconnexion d'un compte ;
 *  - connexion OAuth (code → serveur).
 *
 * Le fournisseur n'est pas câblé en dur : l'écran fournit les adaptateurs
 * (charger, sélectionner, resynchroniser, déconnecter, OAuth) et le hook gère
 * le reste de manière commune.
 */

/** États d'action d'un fournisseur de calendrier. */
export type ActionCompte = null | 'connexion' | 'enregistrement' | 'deconnexion';

export type UseAgendaImportOptions<TCompte extends CompteImport = CompteImport, TCalendrier extends CalendrierImport = CalendrierImport> = {
    api: AxiosInstance;
    /** Préfixe i18n des messages : 'google' | 'outlook'. */
    prefixe: 'google' | 'outlook';
    /** Charge les comptes + calendriers du membre pour le fournisseur. */
    chargerComptesEtCalendriers: () => Promise<{ comptes: TCompte[]; calendriers: TCalendrier[] }>;
    /** Envoie la sélection → jobId (null si rien) + nombre de calendriers retirés. */
    selectionner: (idsExternes: string[]) => Promise<{ jobId: string | null; calendriersDesactives: number }>;
    /** Relance l'import d'un calendrier. */
    relancerImport: (idPublique: string) => Promise<string>;
    /** Déconnecte un compte. */
    deconnecterCompte: (idPublique: string) => Promise<void>;
    /** OAuth : obtient le code d'autorisation (ou null si l'utilisateur annule). */
    obtenirCode: () => Promise<{ code: string; code_verifier?: string; client_id?: string } | null>;
    /** OAuth : envoie le code au serveur (échange + stockage). */
    connecterCompte: (api: AxiosInstance, code: string, codeVerifier?: string, clientId?: string) => Promise<void>;
};

export function useAgendaImport<TCompte extends CompteImport, TCalendrier extends CalendrierImport>(options: UseAgendaImportOptions<TCompte, TCalendrier>) {
    const { api, prefixe } = options;
    const optionsRef = useRef(options);
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);
    const { t } = useTranslation('calendar');

    const [chargement, setChargement] = useState(true);
    const [comptes, setComptes] = useState<TCompte[]>([]);
    const [calendriers, setCalendriers] = useState<TCalendrier[]>([]);
    const [selection, setSelection] = useState<Set<string>>(new Set());
    const [action, setAction] = useState<ActionCompte>(null);
    const [progression, setProgression] = useState<ProgressionImport | null>(null);
    const arreterSuivi = useRef<(() => void) | null>(null);

    // on ne laisse pas un flux SSE ouvert derrière l'écran
    useEffect(() => () => {
        arreterSuivi.current?.();
        arreterSuivi.current = null;
    }, []);

    // recharge les comptes et les calendriers, et pré-sélectionne ce qui est déjà importé
    const charger = useCallback(async () => {
        try {
            const { comptes: listeComptes, calendriers: listeCalendriers } = await optionsRef.current.chargerComptesEtCalendriers();
            setComptes(listeComptes);
            setCalendriers(listeCalendriers);
            setSelection(new Set(listeCalendriers.filter(c => c.actif).map(c => c.id_externe)));
        } catch (error) {
            catcher(error, t(`${prefixe}.loadFailed`));
        } finally {
            setChargement(false);
        }
    }, [prefixe, t]);

    useFocusEffect(useCallback(() => {
        void charger();
    }, [charger]));

    const suiviEnCours = progression !== null && progression.statut === 'en_cours';
    const occupe = action !== null || suiviEnCours;

    // calendriers que l'utilisateur peut cocher (un calendrier déjà lié à un
    // autre compte reste importé mais n'est pas re sélectionnable ici)
    const selectionnables = calendriers.filter(c => c.disponible);
    const toutCoche = selectionnables.length > 0 && selectionnables.every(c => selection.has(c.id_externe));

    const basculer = useCallback((idExterne: string) => {
        setSelection(current => {
            const suivant = new Set(current);
            if (suivant.has(idExterne)) suivant.delete(idExterne);
            else suivant.add(idExterne);
            return suivant;
        });
    }, []);

    const mettreAJourCalendrier = useCallback((idPublique: string, modifications: Partial<TCalendrier>) => {
        setCalendriers(current => current.map(calendrier =>
            calendrier.id_publique === idPublique ? { ...calendrier, ...modifications } : calendrier,
        ));
    }, []);

    /**
     * Coche/décoche tous les calendriers sélectionnables.
     * Les calendriers déjà importés mais liés à un autre compte ne sont pas
     * sélectionnables : on ne les retire pas de la sélection (sinon le serveur
     * les désactiverait).
     */
    const toutBasculer = useCallback(() => {
        const ids = selectionnables.map(c => c.id_externe);
        setSelection(current => {
            const suivant = new Set(current);
            const toutCocheLocal = ids.length > 0 && ids.every(id => suivant.has(id));
            for (const id of ids) {
                if (toutCocheLocal) suivant.delete(id);
                else suivant.add(id);
            }
            return suivant;
        });
    }, [selectionnables]);

    /** Démarre le suivi d'un import et rafraîchit la liste à la fin. */
    const suivre = useCallback((jobId: string) => {
        arreterSuivi.current?.();
        setProgression({ groupId: jobId, total: 0, done: 0, statut: 'en_cours', jobs: [] });
        const arret = suivreImport(api, jobId, {
            onProgression: setProgression,
            onFin: (final) => {
                setProgression(final);
                arreterSuivi.current = null;
                if (final.statut === 'erreur') {
                    ToastAbs.show({ type: toastTypes.error, text2: t(`${prefixe}.importFailed`) });
                } else {
                    ToastAbs.show({ type: toastTypes.success, text2: t(`${prefixe}.importDone`) });
                }
                void charger();
            },
        });
        arreterSuivi.current = arret;
    }, [api, prefixe, t, charger]);

    /** Envoie la sélection : le serveur active/désactive et lance l'import. */
    const enregistrer = useCallback(async () => {
        setAction('enregistrement');
        try {
            const { jobId, calendriersDesactives } = await optionsRef.current.selectionner(Array.from(selection));
            if (!jobId) {
                // rien à importer : la sélection a bien été enregistrée (des
                // calendriers ont pu être retirés).
                ToastAbs.show({
                    type: toastTypes.success,
                    text2: calendriersDesactives > 0
                        ? t(`${prefixe}.calendarsRemoved`, { count: calendriersDesactives })
                        : t(`${prefixe}.selectionSaved`),
                });
                await charger();
                return;
            }
            suivre(jobId);
        } catch (error) {
            const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
            if (code && code.endsWith('_reauth')) {
                ToastAbs.show({ type: toastTypes.warning, text2: t(`${prefixe}.needsReconnect`) });
                return;
            }
            catcher(error, t(`${prefixe}.importFailed`));
        } finally {
            setAction(null);
        }
    }, [selection, prefixe, t, suivre, charger]);

    /** Relance l'import d'un seul calendrier. */
    const resynchroniser = useCallback(async (calendrier: TCalendrier) => {
        if (!calendrier.id_publique) return;
        setAction('enregistrement');
        try {
            const jobId = await optionsRef.current.relancerImport(calendrier.id_publique);
            suivre(jobId);
        } catch (error) {
            const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
            if (code && code.endsWith('_reauth')) {
                ToastAbs.show({ type: toastTypes.warning, text2: t(`${prefixe}.needsReconnect`) });
                return;
            }
            catcher(error, t(`${prefixe}.importFailed`));
        } finally {
            setAction(null);
        }
    }, [prefixe, t, suivre]);

    /** Déconnecte un compte : ses calendriers sont désactivés et ses événements retirés. */
    const deconnecter = useCallback(async (compte: TCompte) => {
        setAction('deconnexion');
        try {
            await optionsRef.current.deconnecterCompte(compte.id);
            ToastAbs.show({ type: toastTypes.success, text2: t(`${prefixe}.disconnected`) });
            await charger();
        } catch (error) {
            catcher(error, t(`${prefixe}.disconnectFailed`));
        } finally {
            setAction(null);
        }
    }, [prefixe, t, charger]);

    /** Connecte un compte : consentement OAuth puis envoi du code à l'API. */
    const connecter = useCallback(async () => {
        setAction('connexion');
        try {
            const code = await optionsRef.current.obtenirCode();
            if (!code) return; // l'utilisateur a annulé
            await optionsRef.current.connecterCompte(api, code.code, code.code_verifier, code.client_id);
            ToastAbs.show({ type: toastTypes.success, text2: t(`${prefixe}.connected`) });
            await charger();
        } catch (error) {
            if (error instanceof Error && error.name === 'ConfigurationOAuthInvalide') {
                ToastAbs.show({ type: toastTypes.error, text2: t(`${prefixe}.misconfigured`) });
                return;
            }
            catcher(error, t(`${prefixe}.connectFailed`));
        } finally {
            setAction(null);
        }
    }, [api, prefixe, t, charger]);

    return {
        chargement,
        comptes,
        calendriers,
        selection,
        action,
        progression,
        occupe,
        selectionnables,
        toutCoche,
        basculer,
        mettreAJourCalendrier,
        toutBasculer,
        charger,
        suivre,
        enregistrer,
        resynchroniser,
        deconnecter,
        connecter,
    };
}
