import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ToastAbs from "@/abstractions/toastAbs";
import { toastTypes } from "@/constants/toastConfig";
import { useAPI } from "@/contextes/contexteAPI";
import { useMembre } from "@/contextes/contexteMembre";
import catcher from "@/functions/catcher";
import { convertUTCToLocal } from "@/functions/convertirUTCenLocal";

/** A slot where every participant is free (a common free slot). Dates: UTC ISO. */
export type Creneau = { debut: string, fin: string, deja_propose: boolean }

/** An open suggestion with its votes. Dates: UTC ISO. */
export type Suggestion = {
    id: string
    debut: string
    fin: string
    proposeur: string
    oui: number
    non: number
    mon_vote: 'oui' | 'non' | null
}

/** GET /postpone/evenements/:id */
export type DonneesReport = {
    est_createur: boolean
    reportable: boolean
    peut_proposer: boolean
    peut_deplacer: boolean
    suggestions: Suggestion[]
    creneaux: Creneau[]
}

/**
 * An event's postponement data (GET /postpone/evenements/:id) and sending one of its
 * common free slots (every participant free), by the member's role: an invitee
 * proposes it (the others then vote), the creator moves the event there (the invitees
 * confirm again). The screens confirm in place (ConfirmationEnvoi) before calling
 * `envoyerCreneau`; problems are shown as toasts, no native alert.
 * Shared by the event's page (PanneauReport) and the invitation review ("adjust my
 * schedule").
 *
 * @author Philip — user story 23 (common free slots): taken out of PanneauReport
 * @param {string | null | undefined} idEvenement - Public id; nothing is loaded without it.
 * @param {{ onPlageChangee?: () => void }} [options] - Called once the creator moved the event.
 * @returns {{ donnees: DonneesReport | null, charger: () => Promise<void>, enCours: string | null,
 *   setEnCours: (v: string | null) => void, plage: (debut: string, fin: string) => string,
 *   envoyerCreneau: (creneau: Creneau) => Promise<boolean>, alerterRefus: (error: any) => Promise<boolean> }}
 */
export default function useReportEvenement(idEvenement: string | null | undefined, { onPlageChangee }: { onPlageChangee?: () => void } = {}) {
    const { t } = useTranslation('events')
    const { api } = useAPI()
    const { membre } = useMembre()

    const [donnees, setDonnees] = useState<DonneesReport | null>(null)
    // What is being sent: 'creneau', 'appliquer', or a suggestion id (vote).
    const [enCours, setEnCours] = useState<string | null>(null)

    const charger = useCallback(async () => {
        if (!idEvenement) return
        try {
            const reponse = await api.get(`/postpone/evenements/${idEvenement}`)
            setDonnees(reponse.data)
        } catch (error) {
            catcher(error, t('postpone.loadFailed'))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idEvenement])

    useEffect(() => {
        if (!idEvenement) return
        api.get(`/postpone/evenements/${idEvenement}`)
            .then((reponse) => setDonnees(reponse.data))
            .catch((error) => catcher(error, t('postpone.loadFailed')))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idEvenement])

    /**
     * "Tue 12 Nov from 14:00 to 15:00", in the member's timezone.
     *
     * @param {string} debut - UTC ISO.
     * @param {string} fin - UTC ISO.
     * @returns {string}
     */
    const plage = (debut: string, fin: string) => {
        const d = convertUTCToLocal(debut, membre?.timezone)
        const f = convertUTCToLocal(fin, membre?.timezone)
        return t('postpone.range', { jour: d.toFormat('ccc d LLL'), debut: d.toFormat('HH:mm'), fin: f.toFormat('HH:mm') })
    }

    /**
     * A 409 of moving / applying, as a toast: someone isn't free then anymore (the API
     * closed what was in the way), or something in the creator's own schedule.
     *
     * @param {any} error
     * @returns {Promise<boolean>} Whether it was such a refusal (else the caller reports it).
     */
    const alerterRefus = async (error: any) => {
        const donneesErreur = error?.response?.status === 409 ? error.response.data : null
        if (donneesErreur?.indisponibles?.length) {
            ToastAbs.show({ type: toastTypes.error, text1: t('postpone.notFreeTitle'), text2: t('postpone.notFreeMessage', { pseudos: donneesErreur.indisponibles.join(', ') }) })
            await charger()
            return true
        }
        if (Array.isArray(donneesErreur?.evenements) && donneesErreur.evenements.length) {
            ToastAbs.show({
                type: toastTypes.error,
                text1: t('postpone.conflictTitle'),
                text2: t('postpone.conflictMessage', { titres: donneesErreur.evenements.map((c: any) => c.titre).filter(Boolean).join(', ') }),
            })
            return true
        }
        return false
    }

    /**
     * Sends a confirmed common free slot: the creator moves the event there, an invitee
     * proposes it.
     *
     * @param {Creneau} creneau
     * @returns {Promise<boolean>} Whether it was sent.
     */
    const envoyerCreneau = async (creneau: Creneau) => {
        if (!donnees || enCours) return false
        const deplacement = donnees.peut_deplacer
        setEnCours('creneau')
        try {
            await api.post(`/postpone/evenements/${idEvenement}${deplacement ? '/deplacer' : ''}`, { debut: creneau.debut, fin: creneau.fin })
            ToastAbs.show({
                type: toastTypes.success,
                text1: t(deplacement ? 'postpone.movedTitle' : 'postpone.sentTitle'),
                text2: t(deplacement ? 'postpone.movedMessage' : 'postpone.sentMessage'),
                position: 'top',
            })
            await charger()
            if (deplacement) onPlageChangee?.()
            return true
        } catch (error: any) {
            if (!(await alerterRefus(error))) catcher(error, t(deplacement ? 'postpone.moveFailed' : 'postpone.proposeFailed'))
            return false
        } finally {
            setEnCours(null)
        }
    }

    return { donnees, charger, enCours, setEnCours, plage, envoyerCreneau, alerterRefus }
}
