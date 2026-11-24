import catcher from '@/functions/catcher'
import formaterDatePourServeur from '@/functions/formaterDatePourServeur'

import Icon from "@react-native-vector-icons/ionicons"
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, View } from 'react-native'

import { useActionFab } from '@/hooks/useActionFAB'
import { avertirIndisponibles } from '@/hooks/useEnvoiCreation'

import { Event } from '@/types/calendar'

import EventForm, { EventFormHandle } from '@/components/eventForm'

import ToastAbs from '@/abstractions/toastAbs'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import { useInvites } from '@/contextes/contexteInvites'
import { usePalette } from '@/contextes/contextePalette'
import { DateTime } from 'luxon'

/** The event's own fields to save: PATCH (or an occurrence's exception) and its body. */
type Patch = { url: { method: string, string: string }, data: any }

/**
 * Whether a form date and an event date are the same minute. The event reaches this page
 * JSON-serialized: its debut / fin are ISO strings, which never equaled the server format
 * they were compared to, so every save counted as a time change.
 *
 * @param {DateTime} dt - Date from the form.
 * @param {unknown} valeur - The event's date (ISO string, or DateTime).
 * @returns {boolean}
 */
function memeMinute(dt: DateTime, valeur: unknown): boolean {
    const autre = DateTime.isDateTime(valeur) ? valeur
        : typeof valeur === 'string' ? DateTime.fromISO(valeur) : null
    return !!autre?.isValid && dt.toUTC().startOf('minute').toMillis() === autre.toUTC().startOf('minute').toMillis()
}

/**
 * Frequency and end (to the minute) of a rule as the form writes it
 * ('DTSTART:…\nFREQ=WEEKLY;UNTIL=20261231T010000Z'), or nulls without a rule.
 *
 * @param {string | null | undefined} regle
 * @returns {{ freq: string | null, until: string | null }}
 */
function lireRecurrence(regle?: string | null): { freq: string | null, until: string | null } {
    return {
        freq: regle?.match(/FREQ=([A-Z]+)/)?.[1] ?? null,
        until: regle?.match(/UNTIL=(\d{8}T\d{4})/)?.[1] ?? null,
    }
}

export default function EditEvent() {
    const { t } = useTranslation('events')
    const { api } = useAPI()
    const { colors } = usePalette()
    const { event: eventStringified } = useLocalSearchParams<{ event: string }>()
    const event = JSON.parse(eventStringified) as Event

    // Original values are meant to see which changed
    const original = useRef({
        titre: event.titre,
        description: event.description,
        prive: !!event.prive,
        debut: event.debut,
        fin: event.fin,
        regle: event.regle_recurrence ?? null,
    })

    // Le formulaire vit son propre state en interne. EditEvent ne fait que
    // lui poser une question au moment du submit : "quelles sont tes valeurs ?"
    const formRef = useRef<EventFormHandle>(null)

    // Participants added / removed in the form, only sent with ✓ (Philip).
    const navigation = useNavigation()
    const { invites, retraits, resetInvites } = useInvites()
    // One save at a time (double tap on ✓).
    const enregistrementRef = useRef(false)

    // A fresh form: nothing left from another one. Leaving without ✓ (back, cancel)
    // drops the participants changes: nobody is invited nor removed.
    useEffect(() => {
        resetInvites()
        const unsubscribe = navigation.addListener('removed', () => resetInvites())
        return () => queueMicrotask(unsubscribe)
    }, [navigation, resetInvites])

    const verifAvantPatch = (): void => {
        const values = formRef.current?.getValues()
        let valid = true
        let message = t('edit.defaultError')
        if (!values) return

        // regle_recurrence: null removes the recurrence; type: an exception's 'modifie'.
        const data: Omit<Partial<Event>, 'regle_recurrence' | 'type'> & Record<string, any> = {}
        const champsModifies: string[] = []

        if (values.titre !== original.current.titre) {
            data.titre = values.titre            
            champsModifies.push('titre')
        }
        if (values.description !== original.current.description) {
            data.description = values.description
            champsModifies.push('description')
        }
        if (values.prive !== original.current.prive) {
            data.prive = values.prive ? 1 : 0
            champsModifies.push('prive')
        }

        // An unavailability's title is its optional reason (Philip — user story 20).
        if (event.nature !== 'indisponibilite' && values.titre.length < 4) {
            valid = false
            message = t('edit.titleTooShort')
        }

        if (!valid) {
            catcher({message}, t('edit.validationErrorTitle'))
            return
        }

        const debutServeur = formaterDatePourServeur(values.start.toUTC())
        const finServeur = formaterDatePourServeur(values.end.toUTC())

        const debutChange = !memeMinute(values.start, original.current.debut)
        if (debutChange) {
            data.debut = debutServeur
            champsModifies.push('debut')
        }
        if (!memeMinute(values.end, original.current.fin)) {
            data.fin = finServeur
            champsModifies.push('fin')
        }

        // The recurrence was never compared: changed alone, nothing was saved; with other
        // changes, it was dropped. A rule without an end (not one of ours) only compares
        // its frequency. Its DTSTART follows the start: when the start of a recurring event
        // moves, the rule is sent again too. Philip — rectification.
        const avant = lireRecurrence(original.current.regle)
        const apres = lireRecurrence(values.regleRecurrence)
        const recurrenceChange = avant.freq !== apres.freq
            || (avant.freq !== null && avant.until !== null && avant.until !== apres.until)
        if (recurrenceChange || (values.regleRecurrence && debutChange)) {
            data.regle_recurrence = values.regleRecurrence
            if (recurrenceChange) champsModifies.push('regle_recurrence')
        }

        const participantsChanges = invites.length > 0 || retraits.length > 0
        if (champsModifies.length === 0 && !participantsChanges) return
        // Saved: a retry after a later failure (e.g. the invitations) doesn't send the
        // event's fields again, which would notify its participants a second time.
        const sauves = () => {
            original.current = {
                titre: values.titre,
                description: values.description,
                prive: values.prive,
                debut: values.start,
                fin: values.end,
                regle: values.regleRecurrence,
            }
        }
        const champsToast = participantsChanges ? [...champsModifies, 'participants'] : champsModifies

        // Only participants changed: the event itself isn't sent, so the other
        // participants aren't notified nor asked again.
        if (champsModifies.length === 0) {
            enregistrer(null, champsToast, sauves)
            return
        }

        data.debut = data.debut ?? debutServeur
        data.fin = data.fin ?? finServeur

        let url = { method: 'PATCH', string: `/evenements/${event.id}` } as {
            method: string
            string: string
        }

        if (event && event.type === 'recurrence' && event.regle_recurrence) {
            Alert.alert(
                t('details.recurringEditTitle'),
                t('details.recurringEditMessage'),
                [
                    {
                        text: t('details.editSeries'),
                        onPress: () => {
                            // The form's rule: it was rebuilt from the OLD rule with UNTIL
                            // set to this occurrence's end, which cut the series short.
                            data.regle_recurrence = values.regleRecurrence
                            enregistrer({ url, data }, champsToast, sauves)
                        },
                    },
                    {
                        text: t('details.editOccurrence'),
                        onPress: () => {
                            url = { method: 'POST', string: `/evenements/exceptions` }
                            data.id_parent = event.id
                            // evenements_exceptions.type is 'modifie' | 'annule': 'exception'
                            // was rejected (500, strict SQL mode).
                            data.type = 'modifie'
                            data.debut_occurence = formaterDatePourServeur(
                                event.debut ? event.debut : DateTime.now().toUTC()
                            )
                            enregistrer({ url, data }, champsToast, sauves)
                        },
                        isPreferred: true,
                    },
                ]
            )
        } else if (event.type === 'exception') {
            url = { method: 'PATCH', string: `/evenements/exceptions/${event.id}` }
            enregistrer({ url, data }, champsToast, sauves)
        } else {
            enregistrer({ url, data }, champsToast, sauves)
        }
    }

    /**
     * Saves the edit on ✓, in one go, in this order:
     * 1. the participants removed in the form (before a time change, so they don't get
     *    its notification);
     * 2. the event's own fields, when some changed;
     * 3. the friends added in the form are invited (with the event's new time).
     * Each step can be retried: the API's removal and invitation skip what's already
     * done, and the fields aren't sent twice (`sauves`). Then back to the details.
     *
     * @author Philip — participants changes only sent with ✓ (they used to be sent as soon
     *   as a friend was picked or a participant removed, even if the edit was cancelled)
     * @param {Patch | null} patch - The event's fields to save, null when only participants changed.
     * @param {string[]} champsModifies - What changed, for the confirmation toast.
     * @param {() => void} sauves - Records the fields as saved once sent.
     * @returns {Promise<void>}
     */
    const enregistrer = async (patch: Patch | null, champsModifies: string[], sauves: () => void) => {
        if (enregistrementRef.current) return
        enregistrementRef.current = true
        const urlParticipants = `/evenements/${event.id}/participants`
        try {
            // 1. Removals (the API's DELETE answers 200 even if already removed).
            for (const participant of retraits) {
                await api.delete(`${urlParticipants}/${participant.id}`)
            }
            // 2. The event's fields (any 2xx: axios throws on an error status).
            if (patch) {
                await api.request({ method: patch.url.method, url: patch.url.string, data: patch.data })
                sauves()
            }
            // 3. Invitations (the API skips members who already take part).
            if (invites.length > 0) {
                const reponse = await api.post(urlParticipants, {
                    participants: invites.map((invite) => ({ id: invite.id, privilege: invite.privilege })),
                })
                // Left out by the API (unavailable then): named in a warning.
                avertirIndisponibles(reponse.data?.indisponibles, reponse.data?.bloques)
            }
            ToastAbs.show({
                type: toastTypes.success,
                text1: t('edit.updatedTitle'),
                text2: t('edit.modifiedFields', { fields: champsModifies.join(', ') }),
            })
            resetInvites()
            router.back()
        } catch (error) {
            catcher(error, t('errors.updateFailed'))
        } finally {
            enregistrementRef.current = false
        }
    }

    // Called with useActionFab's (owner, { action, config }) signature: it got a single
    // object, so the ✓ never registered its action and the page couldn't be confirmed.
    // Rectification (Philip — user story 20, review).
    useActionFab("eventEdit", {
        action: verifAvantPatch,
        config: {
            visible: true,
            icon: <Icon name="checkmark" color={colors.text} size={28} />,
        },
    })

    return (
        <View style={{ flex: 1 }}>
            {/* An unavailability keeps its own form: reason, no participants (user story 20). */}
            <EventForm ref={formRef} event={event} mode={'edit'} nature={event.nature} />
        </View>
    )
}
