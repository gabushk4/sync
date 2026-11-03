import { useCallback, useRef, useState } from "react";

import ToastAbs from "@/abstractions/toastAbs";
import type { EventFormValues } from "@/components/eventForm";
import { toastTypes } from "@/constants/toastConfig";
import { convertLocalToUTC } from "@/functions/convertirUTCenLocal";
import formaterDatePourServeur from "@/functions/formaterDatePourServeur";
import i18n from "../i18n";

/**
 * Sending a creation form once: a second tap on ✓ while it's being sent does nothing
 * (a state update isn't visible yet to that tap, hence the ref), and `enChargement`
 * shows the spinner (VoileEnvoi) once the form is valid.
 * Shared by the two pages of the creation screen, which each had their own copy.
 *
 * @author Philip — user story 20 (review)
 * @returns {{ enChargement: boolean, envoyerUneFois: (envoi: (demarrerChargement: () => void) => Promise<void>) => Promise<void> }}
 *   `envoi` calls `demarrerChargement` once it's about to send.
 */
export default function useEnvoiCreation() {
    const [enChargement, setEnChargement] = useState(false)
    const envoiEnCoursRef = useRef(false)

    const envoyerUneFois = useCallback(async (envoi: (demarrerChargement: () => void) => Promise<void>) => {
        if (envoiEnCoursRef.current) return
        envoiEnCoursRef.current = true
        try {
            await envoi(() => setEnChargement(true))
        } finally {
            envoiEnCoursRef.current = false
            setEnChargement(false)
        }
    }, [])

    return { enChargement, envoyerUneFois }
}

/**
 * POST /evenements/ fields common to an event and an unavailability, from the form's
 * values (dates converted to UTC SQL).
 *
 * @author Philip — user story 20 (review): shared by both creation pages
 * @param {EventFormValues} values
 * @returns {{ titre: string, description: string, prive: boolean, debut: string | null, fin: string | null, regle_recurrence: string | null }}
 */
export function corpsCreation(values: EventFormValues) {
    return {
        titre: values.titre.trim(),
        description: values.description,
        prive: values.prive,
        debut: formaterDatePourServeur(convertLocalToUTC(values.start)),
        fin: formaterDatePourServeur(convertLocalToUTC(values.end)),
        regle_recurrence: values.regleRecurrence,
    }
}

/**
 * Tells the inviter which friends weren't invited because they're unavailable then
 * (`indisponibles` of POST /evenements/ and POST /evenements/:id/participants).
 *
 * @author Philip — user story 20 (not receiving invitations while unavailable)
 * @param {{ pseudo: string }[] | undefined} indisponibles
 * @returns {void}
 */
export function avertirIndisponibles(indisponibles?: { pseudo: string }[]) {
    if (!indisponibles?.length) return
    ToastAbs.show({
        type: toastTypes.warning,
        text1: i18n.t('events:unavailability.leftOutTitle'),
        text2: i18n.t('events:unavailability.leftOut', {
            count: indisponibles.length,
            pseudos: indisponibles.map((i) => i.pseudo).join(', '),
        }),
    })
}
