import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';


import { useAPI } from "@/contextes/contexteAPI";
import { useConversations } from "@/contextes/contexteConversations";
import { useFont } from "@/contextes/contexteFont";
import { useMembre } from "@/contextes/contexteMembre";
import { usePalette } from "@/contextes/contextePalette";

import catcher from "@/functions/catcher";
import chargerDetailsEvenement from "@/functions/chargerDetailsEvenement";
import log from "@/functions/log";

import EventForm from "@/components/eventForm";
import Spinner from "@/components/spinner";
import useGestionEvenement from "@/hooks/useGestionEvenement";
import { useNavFab } from "@/hooks/useNavFAB";
import PanneauDecisionInvitation from "@/components/panneauDecisionInvitation";
import PanneauReport from "@/components/panneauReport";
import ouvrirRevueInvitation from "@/functions/ouvrirRevueInvitation";
import useDecisionInvitation from "@/hooks/useDecisionInvitation";
import { InvitationInfo } from "@/types/invitation";
import { defaultEvent, Event } from "@/types/calendar";
import Icon from "@react-native-vector-icons/ionicons";

export default function Details(){
    const { t } = useTranslation('events')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { api } = useAPI()
    const isFocused = useIsFocused()
    const { membre } = useMembre()
    
    const { eventId, start, end, invitation: invitationParam, depuisRevue } = useLocalSearchParams()
    const navigation = useNavigation()

    // Decision mode: opened from the invitation review by tapping the leader's invited
    // event. The event is read-only (no edit / delete); a panel lists its participants
    // with their answer and offers accept / refuse.
    // Philip — user story 8 (answering an invitation in conflict).
    const invitation = useMemo<InvitationInfo | null>(
        () => (typeof invitationParam === 'string' ? JSON.parse(invitationParam) : null),
        [invitationParam]
    )
    // "Adjust my schedule" (panel button or conflict screen): back to the review this
    // page was opened from, else open it (page opened from the feed).
    const voirHoraire = () => {
        if (depuisRevue) router.back()
        else if (invitation) ouvrirRevueInvitation(invitation)
    }
    const decision = useDecisionInvitation(invitation, {
        // Answered: back to the home timeline (the invitation review is done).
        onRepondu: () => navigation.dispatch({ type: 'POP_TO_TOP' }),
        onVoirHoraire: voirHoraire,
    })

    const [event, setEvent] = useState<Event>(defaultEvent)  

    const isExternal = useMemo(() => event.nom_calendrier !== undefined && (event.source == 'google' || event.source === 'outlook' || event.source === 'device') ,[event])

    // Story #21 : the shared event's group conversation (only sent when the member is in it)
    const { rafraichirConversations } = useConversations()
    const ouvrirConversation = () => {
        if (!event.conversation_id) return
        rafraichirConversations()
        router.push({
            // in the home stack, over this page: its back arrow returns here
            pathname: '/(tabs)/home/conversation/[conversationId]',
            params: { conversationId: event.conversation_id, titre: event.titre ?? '' },
        })
    }

    // Delete (editor) / leave (anyone else), shared with the notification card.
    // The occurrence that was opened (timeline / calendar `start` / `end`): deleting "this
    // one" cancels it, not the series' first (Philip — user story 20, review).
    const occurrence = useMemo(() => {
        const debutOcc = typeof start === 'string' ? DateTime.fromISO(start) : null
        const finOcc = typeof end === 'string' ? DateTime.fromISO(end) : null
        return debutOcc?.isValid && finOcc?.isValid ? { debut: debutOcc, fin: finOcc } : undefined
    }, [start, end])
    const gestion = useGestionEvenement(event, { onTermine: () => router.back(), occurrence })

    const getDetails = async (id: string) => {
        try {
            setEvent(await chargerDetailsEvenement(
                api, id, membre.timezone,
                typeof start === "string" ? start : undefined,
                typeof end === "string" ? end : undefined,
            ))
        } catch (error) {
            router.back()
            catcher(error, t('errors.loadFailed'))
        }
    }

    const FABParams = useMemo(
        () => ({ event: JSON.stringify(event) }),
        [event]
    )
    log("visible", !invitation || event.nom_calendrier == undefined)
    useNavFab("details", {
            icon: <Icon name="pencil" size={24} color={colors.text} />,
            href: '/(tabs)/home/edit/[event]' as const,
            params: FABParams,
            // No editing while deciding on an invitation, nor for a reader: the API only
            // lets an editor change an event (Philip — user story 20, review).
            visible: !invitation && !isExternal && event.privilege_membre === 'editeur',
        })

    // An unavailability: its own form (reason, no participants) and no postponement
    // (Philip — user story 20).
    const indisponibilite = event.nature === 'indisponibilite'

    useFocusEffect(useCallback(() => {
        if (typeof eventId === 'string')
            getDetails(eventId)
        return () => {
        }
    }, [isFocused, eventId, membre?.timezone]))

    useEffect(() => {
        log("event dans details", event)
    }, [event])

    // Header: "Détails de l'évènement", or "Détails de l'indisponibilité" for an unavailability
    useEffect(() => {
        navigation.setOptions({
            headerTitle: t(event.nature === 'indisponibilite' ? 'navigation.unavailabilityDetails' : 'navigation.details'),
        })
    }, [event.nature, navigation, t])

    const s = StyleSheet.create({
        // Story #21: bottom panel holding the conversation block (same look as PanneauReport's)
        panneau: {
            backgroundColor: colors.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 90, // room for the tab bar's FAB area
            gap: 10,
        },
        entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        titreConversation: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 16 },
        floatingBtn: {
            height: 64, 
            width: 64,
            //backgroundColor: colors.secondary,
            position: 'absolute',
            bottom: 16,
            right: 16,
            borderRadius: 100,
            borderWidth: 1, 
            borderColor: colors.error,
            alignItems: 'center',
            justifyContent: 'center'
        }
    })

    // Not loaded yet: a spinner. EventForm computes its dates once, on its first focus:
    // shown with the empty default event, it kept "now" as the dates and warned
    // "Timestamp n'est pas une date" — the event's real dates never showed.
    // Rectification (Philip — user story 20, review).
    if (!event.id) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Spinner size={32} color={colors.muted} />
            </View>
        )
    }

    return (
        <View style={{flex:1}}>
            <EventForm
                key={event.id}
                event={event}
                mode={'details'}
                masquerParticipants={!!invitation}
                nature={event.nature}
            />
            {invitation ? (
                <>
                    <PanneauDecisionInvitation
                        idEvenement={invitation.id_evenement}
                        organisateur={invitation.pseudo_invitant}
                        voirHoraire={voirHoraire}
                        accepter={decision.accepter}
                        refuser={decision.refuser}
                        enCours={decision.enCours}
                    >
                        {/* Proposing another time instead (Philip — user story 23). */}
                        <PanneauReport idEvenement={invitation.id_evenement} integre />
                    </PanneauDecisionInvitation>
                    {decision.conflit}
                </>
            ) : (
                <>
                    {/* Postponement votes: propose / vote (invitee), apply one (creator).
                        Philip — user story 23. */}
                    {/* Story #21: the group conversation is a block of the bottom panel, above
                        the postponement ones (review: no floating button of its own). */}
                    {event.conversation_id ? (
                        <View style={s.panneau}>
                            <TouchableOpacity
                                style={s.entete}
                                onPress={ouvrirConversation}
                                accessibilityRole="button"
                                accessibilityLabel={t('details.openConversation')}
                            >
                                <View style={s.titreConversation}>
                                    <Icon name='chatbubbles-outline' color={colors.secondary} size={20} />
                                    <Text style={s.titre}>{t('details.conversation')}</Text>
                                </View>
                                <Icon name='chevron-forward' color={colors.text} size={20} />
                            </TouchableOpacity>
                            {!indisponibilite && (
                                <PanneauReport integre idEvenement={event.id as string} onPlageChangee={() => getDetails(event.id as string)} />
                            )}
                        </View>
                    ) : (!!event.id && !indisponibilite && (
                        <PanneauReport idEvenement={event.id} onPlageChangee={() => getDetails(event.id as string)} />
                    ))}
                    {/* quit (non-creators) / delete (creator) button */}
                    {isExternal ? null : (
                        <TouchableOpacity style={s.floatingBtn} onPress={gestion.supprimerOuQuitter}>
                            <Icon name='trash-sharp' color={colors.error} size={28} />
                        </TouchableOpacity>
                    )}
                </>
            )}
        </View>
    )
}