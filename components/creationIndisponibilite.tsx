import { useLocalSearchParams, useNavigation } from "expo-router";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DateTime } from "luxon";

import { useAPI } from "@/contextes/contexteAPI";

import { CreationHandle } from "@/components/creationEvenement";
import EventForm, { EventFormHandle } from "@/components/eventForm";
import VoileEnvoi from "@/components/voileEnvoi";
import ToastAbs from "@/abstractions/toastAbs";
import { toastTypes } from "@/constants/toastConfig";
import ConflitEvenement, { SortieConflit } from "@/components/conflitEvenement";
import catcher from "@/functions/catcher";
import { debutDejaPasse, plagePreremplie } from "@/functions/jourCreation";
import titreEvenement from "@/functions/titreEvenement";
import useEnvoiCreation, { corpsCreation } from "@/hooks/useEnvoiCreation";
import { defaultEvent, Event } from "@/types/calendar";
import { conflitsDeLaReponse, EvenementEnConflit, NouvelEvenement } from "@/types/conflit";

/**
 * Unavailability page: a stretch where the member is busy, stored as an event of
 * nature 'indisponibilite' (same conflicts and display as an event). The form is the
 * event one without participants: an optional title (the reason), a description,
 * whether friends see the reason, start / end, "all day" and a recurrence (e.g. every
 * night). While it lasts, friends can't invite the member (see the API's
 * trouverIndisponibles).
 * Second page of the creation screen (swipe from the event page), with the same
 * `start` / `end` route params (ISO). Overlapping something already in the schedule
 * (e.g. "all day" on a day that already holds an event) is only checked on
 * confirming: the API's 409 then opens the conflict screen, like an event's.
 *
 * @author Philip — user story 20
 * @author Philip — user story 20 (review): recurring unavailabilities, sending shared
 *   with the event page (useEnvoiCreation), and a conflict opens the same conflict screen
 *   as an event (remove what is in the way, or go back) instead of a short error toast
 *   that left nothing to do but tap ✓ again
 * @returns {JSX.Element}
 */
const CreationIndisponibilite = forwardRef<CreationHandle>(function CreationIndisponibilite(_, ref) {
    const { t } = useTranslation('events')
    const navigation = useNavigation()
    const { api } = useAPI()

    const formRef = useRef<EventFormHandle>(null)
    const [event] = useState<Event>(defaultEvent)
    const { enChargement, envoyerUneFois } = useEnvoiCreation()
    // Conflict screen over this page (409 answer), or null.
    const [conflit, setConflit] = useState<{ existants: EvenementEnConflit[], nouvelle: NouvelEvenement } | null>(null)

    const { start, end } = useLocalSearchParams<{ start?: string, end?: string }>()
    const maintenant = DateTime.now()
    const { debutSuggere, finDemandee } = plagePreremplie(start, end, maintenant)

    /**
     * Validates the form (start not past) and sends the unavailability, then goes
     * back to the home timeline. A 409 (overlap) shows what is in the way.
     *
     * @author Philip — user story 20
     * @returns {Promise<void>}
     */
    const envoyer = () => envoyerUneFois(async (demarrerChargement) => {
        // Kept outside the try so the 409 handler can hand it to the conflict screen.
        let nouvelle: NouvelEvenement | undefined
        try {
            const values = formRef.current?.getValues()
            if (!values) return
            if (debutDejaPasse(values.start, values.end)) {
                ToastAbs.show({ type: toastTypes.error, text2: t('create.pastStart') })
                return
            }

            demarrerChargement()
            nouvelle = {
                nature: 'indisponibilite',
                // An empty title (no reason) is shown as "Unavailable" (titreEvenement).
                ...corpsCreation(values),
                participants: [],
                depuis_dispo_commune: false
            }
            const response = await api.post('/evenements/', nouvelle)
            if (response.status === 201) {
                ToastAbs.show({
                    type: toastTypes.success,
                    text1: t('unavailability.createdTitle'),
                    text2: t('unavailability.createdMessage'),
                    autoHide: true,
                })
                navigation.dispatch({ type: 'POP_TO_TOP' })
            }
        } catch (error: any) {
            if (error.response?.status === 409 && nouvelle) {
                // Same conflict screen as an event: what is in the way, which can be
                // removed to create the unavailability, or back to adjust it.
                setConflit({ existants: conflitsDeLaReponse(error.response.data), nouvelle })
            } else {
                catcher(error, t('unavailability.createFailed'))
            }
        }
    })

    /**
     * The conflict screen is left: closes it; created → back to the home
     * timeline, "adjust" → back to where the creation started, else stays on the form.
     *
     * @author Philip — user story 20 (review)
     * @param {SortieConflit} sortie
     * @returns {void}
     */
    const quitterConflit = (sortie: SortieConflit) => {
        setConflit(null)
        if (sortie === 'retour') navigation.goBack()
        else if (sortie === 'accueil') navigation.dispatch({ type: 'POP_TO_TOP' })
    }

    useImperativeHandle(ref, () => ({ envoyer }))

    return (
        <>
            <EventForm
                ref={formRef}
                event={event}
                mode={'create'}
                nature="indisponibilite"
                prefills={{ start: debutSuggere, end: finDemandee }}
                constraints={{ maximumStart: finDemandee, minimumStart: maintenant }}
            />
            {enChargement && <VoileEnvoi />}
            {conflit && (
                <ConflitEvenement
                    existants={conflit.existants}
                    evenement={{ titre: titreEvenement(conflit.nouvelle), debut: conflit.nouvelle.debut, fin: conflit.nouvelle.fin }}
                    confirmer={() => api.post('/evenements/', conflit.nouvelle)}
                    onSortie={quitterConflit}
                />
            )}
        </>
    )
})

export default CreationIndisponibilite
