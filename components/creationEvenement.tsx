import { useLocalSearchParams, useNavigation } from "expo-router";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import useEnvoiCreation, { avertirIndisponibles, corpsCreation } from "@/hooks/useEnvoiCreation";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import { useAPI } from "@/contextes/contexteAPI";
import { useInvites } from "@/contextes/contexteInvites";
import { useMembre } from "@/contextes/contexteMembre";

import EventForm from "@/components/eventForm";
import VoileEnvoi from "@/components/voileEnvoi";
import catcher from "@/functions/catcher";
import log from "@/functions/log";
import { defaultEvent, Event } from "@/types/calendar";

import ToastAbs from "@/abstractions/toastAbs";
import { EventFormHandle } from "@/components/eventForm";
import { toastTypes } from "@/constants/toastConfig";
import { Participant } from "@/types/invites";
import { conflitsDeLaReponse, EvenementEnConflit, NouvelEvenement } from "@/types/conflit";
import ConflitEvenement, { SortieConflit } from "@/components/conflitEvenement";
import { debutDejaPasse, plagePreremplie } from "@/functions/jourCreation";
import { DateTime } from "luxon";

/**
 * What a creation page (event or unavailability) exposes to the screen hosting it:
 * the screen's ✓ FAB sends the page currently shown.
 *
 * @author Philip — user story 20
 */
export type CreationHandle = { envoyer: () => Promise<void> }

/**
 * Event creation page. Reads `start`/`end` route params (an ISO date each)
 * to pre-fill the event's date range — used both when tapping a time slot in
 * the day timeline (`start` only) and when dragging a range in the month
 * calendar (`start` and `end` both set — user story 5). An overlap with existing
 * events opens the conflict screen (user story 8).
 *
 * @author Philip — user story 5 (pre-filled day / range from the
 *   calendar) and user story 8 (conflict screen on a 409)
 * @author Philip — rectification for a more conventional display:
 *   the suggested start stays on the chosen day and only the past is blocked
 *   (the chosen day could become unpickable), and a missing title or a past
 *   start get a clear message before anything is sent
 * @author Philip — user story 25 / rectification (user story 20): opened from a
 *   friend's profile, this screen lives in the profile stack (app/(tabs)/profile/create,
 *   `depuis: 'profil'`), so leaving it goes straight back to that profile
 * @author Philip — user story 20: a page of the creation screen (swipe to the
 *   unavailability page), so the ✓ FAB belongs to the screen, which calls `envoyer`
 * @returns {JSX.Element}
 */
const CreationEvenement = forwardRef<CreationHandle>(function CreationEvenement(_, ref) {
    const { t } = useTranslation('events')
    const navigation = useNavigation()
    
    const {api} = useAPI()
    const {invites, resetInvites} = useInvites()
    const {membre, getMembre} = useMembre()
    
    const formRef = useRef<EventFormHandle>(null)

    const { start, end, friend, depuis } = useLocalSearchParams<{ start?: string, end?: string, friend?: string, depuis?: string }>()

    /**
     * Leaves after creating (or dropping, from the conflict screen): pops the home
     * stack back to the home screen (replace stacked a second one over the calendar
     * page when created from there). Opened from a friend's profile (`depuis:
     * 'profil'`, profile stack): back to that profile.
     *
     * @author Philip — user story 25; profile stack: rectification (user story 20).
     *   The previous `retour` param prevented the removal in `beforeRemove` and
     *   navigated to the profile itself, which native-stack doesn't support on iOS
     *   (the screen was removed natively but kept in JS state).
     * @returns {void}
     */
    const quitterApresCreation = () => {
        if (depuis === 'profil') navigation.goBack()
        else navigation.dispatch({ type: 'POP_TO_TOP' })
    }

    // Pre-filled range, never in the past (sorting / past rules: plagePreremplie,
    // shared with the unavailability screen; Philip — user story 20).
    // The suggested start is kept apart from the pickers' minimum: the minimum used
    // to be this suggestion, so its day / hour couldn't be moved earlier (e.g.
    // selecting the 11th late in the evening suggested the 12th at midnight, and the
    // 11th could no longer be picked).
    const maintenant = DateTime.now()
    const { debutSuggere, finDemandee } = plagePreremplie(start, end, maintenant)
    // The pickers only forbid the past.
    const minimumStart = maintenant

    // One send at a time + spinner: a double tap on ✓ used to send the event twice
    // (rectification), now shared with the unavailability page (user story 20).
    const { enChargement, envoyerUneFois } = useEnvoiCreation()

    const [event] = useState<Event>(defaultEvent)

    // Conflict screen shown over this one (409 answer), or null.
    const [conflit, setConflit] = useState<{ existants: EvenementEnConflit[], nouveau: NouvelEvenement } | null>(null)

    /**
     * Opens the conflict screen over this one, which lists every existing event
     * the new one overlaps and can remove them all, then create the new one.
     *
     * @author Philip — user story 8 (event conflicts)
     * @param {EvenementEnConflit[]} existants - Conflicting events, as sent in the API's 409 response.
     * @param {NouvelEvenement} nouveau - The POST body of the event being created, so the
     *   conflict screen can create it itself once the existing ones are removed.
     * @returns {void}
     */
    const afficherConflit = (existants: EvenementEnConflit[], nouveau: NouvelEvenement) => {
        setConflit({ existants, nouveau })
    }

    /**
     * The conflict screen is left: closes it, then navigates from this screen's own
     * stack — one plain action, like the header's back arrow (navigating from the
     * old (modals) route never reached the calendar under this screen):
     * - 'formulaire': stays on this form (also "don't create it");
     * - 'retour' ("adjust my schedule"): back to where the creation started, the
     *   calendar page as it was before pressing "+" (same month, same selection)
     *   or the home timeline;
     * - 'accueil' (created): back to the home timeline.
     *
     * @author Philip — user story 8 (event conflicts)
     * @param {SortieConflit} sortie
     * @returns {void}
     */
    const quitterConflit = (sortie: SortieConflit) => {
        setConflit(null)
        if (sortie === 'retour') navigation.goBack()
        else if (sortie === 'accueil') quitterApresCreation()
    }
    
    /**
     * Story #21 : asks the creator whether a group conversation with the participants
     * should be created along with the shared event. Resolves to the answer.
     */
    const demanderConversation = () => new Promise<boolean>((resolve) => {
        Alert.alert(
            t('create.conversationTitle'),
            t('create.conversationMessage'),
            [
                { text: t('create.conversationNo'), style: 'cancel', onPress: () => resolve(false) },
                { text: t('create.conversationYes'), onPress: () => resolve(true), isPreferred: true },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
        )
    })

    /**
     * Validates the form (title present and long enough, start not past) and
     * submits the new event to the API, then goes back to the home screen on
     * success. If the API answers 409 (overlap with existing events, user story 8),
     * opens the conflict screen.
     *
     * @author Philip — user story 8 (409 → conflict screen) and
     *   rectification (validation messages, back to the existing home screen)
     * @author Philip — user story 20: friends left out because they're unavailable
     *   then are named in a warning; sending shared with the unavailability page
     * @returns {Promise<void>}
     */
    const postEvenement = () => envoyerUneFois(async (demarrerChargement) => {
        // Kept outside the try so the 409 handler can hand it to the conflict screen.
        let nouveau: NouvelEvenement | undefined
        try {
            const values = formRef.current?.getValues()
            if (!values) {
                log('no values')
                return
            }

            log('post event', values)

            let valid = true
            let errorMessage = t('create.unknownError')

            if (!values.titre?.trim()) {
                // Checked first: without a name the API used to answer with a conflict
                // (checked before the title) instead of this error.
                valid = false
                errorMessage = t('create.titleRequired')
            } else if (values.titre.trim().length < 4) {
                valid = false
                errorMessage = t('create.titleTooShort', { title: values.titre })
            } else if (debutDejaPasse(values.start, values.end)) {
                // No events in the past (shared check, Philip — user story 20).
                valid = false
                errorMessage = t('create.pastStart')
            }

            if (valid) {
                // Story #21 : a shared event (with invitees) can get its group conversation
                const creerConversation = invites.length > 0 ? await demanderConversation() : false

                demarrerChargement()

                nouveau = {
                    ...event,
                    ...corpsCreation(values),
                    // kept in `nouveau`, so the conflict screen re-sends it too
                    creer_conversation: creerConversation,
                    participants: invites.map((i) => ({ id: i.id, privilege: i.privilege }))
                }

                const response = await api.post('/evenements/', nouveau)

                if (response.status == 201) {
                    ToastAbs.show({
                        type: toastTypes.success,
                        text1: t('create.createdTitle'),
                        text2: t('create.createdMessage'),
                        autoHide: true,
                    })
                    avertirIndisponibles(response.data?.indisponibles, response.data?.bloques)
                    quitterApresCreation()
                }
            } else {
                ToastAbs.show({ type: toastTypes.error, text2: errorMessage })
            }
        } catch (error: any) {
            // User story 8: the server's verifierDisponibilite found an overlap
            // (including later occurrences of recurring events), show the conflict screen.
            if (error.response?.status == 409 && nouveau) {
                afficherConflit(conflitsDeLaReponse(error.response.data), nouveau)
            } else {
                catcher(error, t('errors.createFailed'))
            }
        }
    })

    useImperativeHandle(ref, () => ({ envoyer: postEvenement }))

    // Invitees picked for this event are dropped once the screen is gone. From main
    // (0276b25, SDK 58): 'removed' instead of a 'beforeRemove' listener, unsubscribed
    // in a microtask — carried over here when create.tsx became this page.
    useEffect(() => {
        const unsubscribe = navigation.addListener('removed', () => resetInvites())
        return () => queueMicrotask(unsubscribe)
    }, [navigation, resetInvites])

    useEffect(() => {
        log("email confirme", membre.emailConfirme)
        if(!membre.emailConfirme)
            getMembre()
    }, [])

    useEffect(()=>{
        log('email confirme', membre.emailConfirme)
    }, [membre.emailConfirme])

    useEffect(() => {
        //log("useEffect event", event)
        log("create opens with", {start: start, end: end, debutSuggere: debutSuggere})
    }, [event])

    return (
        <>
            <EventForm
                ref={formRef}
                event={event}
                mode={'create'}
                prefills={{
                    start: debutSuggere,
                    end: finDemandee,
                    participants: friend ? [JSON.parse(friend as string)] as Array<Participant> : undefined
                }}
                constraints={{
                    maximumStart: finDemandee,
                    minimumStart: minimumStart
                }}
            />
            {/* Event being sent. Rectification (Philip); shared VoileEnvoi (user story 20). */}
            {enChargement && <VoileEnvoi />}
            {conflit && (
                <ConflitEvenement
                    existants={conflit.existants}
                    evenement={{ titre: conflit.nouveau.titre, debut: conflit.nouveau.debut, fin: conflit.nouveau.fin }}
                    confirmer={() => api.post('/evenements/', conflit.nouveau)}
                    onSortie={quitterConflit}
                />
            )}
        </>
    )
})

export default CreationEvenement
