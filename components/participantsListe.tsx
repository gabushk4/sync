import { useFocusEffect } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAPI } from '@/contextes/contexteAPI';
import { useInvites } from '@/contextes/contexteInvites';
import { usePalette } from '@/contextes/contextePalette';

import LegendeStatutsInvitation, { HAUTEUR_LEGENDE } from '@/components/legendeStatutsInvitation';
import ParticipantLigne from '@/components/participantLigne';

import catcher from '@/functions/catcher';
import log from '@/functions/log';

import { LinkAbs } from '@/abstractions/linkAbs';
import { ListType } from '@/app/(modals)/listeAmis';
import { checkMark } from '@/constants/dismissButtons';
import { withTimingConfig } from '@/constants/ReanimatedConfs';
import { useEventDraft } from '@/contextes/contexteEventDraft';
import { useFont } from '@/contextes/contexteFont';
import { useModal } from '@/contextes/contexteModals';
import { Participant } from '@/types/invites';
import Ionicons from '@react-native-vector-icons/ionicons';
import { router } from 'expo-router';
import { FlatList } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

type Props = {
    /** The event's participants (GET), undefined while creating it. */
    participantsUrl: string | undefined;
    listType: ListType
    /**
     * Event form (creation, or edit by an editor): the + adds friends and the X removes
     * participants, in the form only (sent with its ✓). False: the list is read-only
     * (event details).
     */
    peutGererParticipants?: boolean
    /** Reminder of the status icons under the list (event the member was invited to). */
    afficherLegende?: boolean
}

const LINE_HEIGHT = 56
const TITLE_HEIGHT = 32
// The "removed on ✓" note under the list.
const HAUTEUR_NOTE = 24
const MAX_COUNT = 3
const DATA_RENDERER_KEY = "ParticipantsListe"

// Styles statiques : créés UNE fois, pas à chaque render
const s = StyleSheet.create({
    container: {
        width: '100%',
        overflow: 'hidden',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    separator: {
        height: 2,
        marginTop: 2,
        marginBottom: 2
    },
    photo: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 100,
        height: 64,
        width: 64,
        overflow: 'hidden'
    },
    inviter: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    noteRetraits: {
        fontSize: 14,
        height: HAUTEUR_NOTE,
        textAlignVertical: 'center',
        alignSelf: 'center',
    },
})

export default function ParticipantsListe({ participantsUrl, listType, peutGererParticipants = false, afficherLegende = false } : Props){
    const { t } = useTranslation()
    const { colors } = usePalette();
    const {fonts} = useFont()
    const { api } = useAPI()
    const { setDataRendererContent, setDismissButton, removeDataRenderContent, resetDismissButton } = useModal()

    const { invites, retraits, supprimerInvite, retirerParticipant } = useInvites()
    const { friendsSuggestions, friendsHasMore } = useEventDraft()
    const availableFriendIds = useMemo(
        () => friendsSuggestions.map(suggestion => suggestion.id),
        [friendsSuggestions]
    )




    log("friend ids:", availableFriendIds.length, availableFriendIds, friendsSuggestions)

    // Ce que le SERVEUR dit. Vide en mode création (pas d'URL).
    const [participantsServeur, setParticipantsServeur] = useState<Participant[]>([])

    // The participants list is the event's (server). In the form, a friend just picked
    // isn't a participant until its ✓ invites them: listed apart (`aInviter`), under the
    // list and without a status icon — they used to be mixed in with the invited ones,
    // with the same "pending" icon, so they looked already invited. A participant removed
    // in the form is hidden (and offered again in the friend picker, which cancels the
    // removal). The details page (read-only) shows the server's list only. Philip.
    const idsServeur = useMemo(() => new Set(participantsServeur.map((p) => p.id)), [participantsServeur])
    const {participants, participantsTruncated, aInviter} = useMemo(() => {
        const idsRetires = new Set(peutGererParticipants ? retraits.map((r) => r.id) : [])
        const enregistres = participantsServeur.filter((p) => !idsRetires.has(p.id))
        // The truncated list used to be built from the local invites only, so an existing
        // event's participants (from the server) never showed up in its details.
        return {
            participants: enregistres,
            participantsTruncated: enregistres.slice(0, MAX_COUNT),
            aInviter: peutGererParticipants ? invites.filter((i) => !idsServeur.has(i.id)) : [],
        }
    }, [participantsServeur, idsServeur, invites, retraits, peutGererParticipants])
    const nbRetraits = peutGererParticipants ? retraits.length : 0

    const showMore = participants.length > MAX_COUNT


    const computeHeight = (count: number, includeShowMore: boolean) =>
        Math.min(
            LINE_HEIGHT * (MAX_COUNT + (includeShowMore ? 2 : 1) + TITLE_HEIGHT),
            // + 1 line: the + button (form only)
            Math.max(LINE_HEIGHT, LINE_HEIGHT * (count + Number(peutGererParticipants) + Number(includeShowMore)) + TITLE_HEIGHT)
        ) + (afficherLegende ? HAUTEUR_LEGENDE : 0)
        // The form's pending changes: a line per friend to invite, a note for the removals.
        + LINE_HEIGHT * aInviter.length
        + (nbRetraits > 0 ? HAUTEUR_NOTE : 0)

    const targetContainerHeight = computeHeight(participantsTruncated.length, showMore)

    const animatedContainer = useAnimatedStyle(() => {
        return {
            height: withTiming(targetContainerHeight, withTimingConfig)
        }
    }, [targetContainerHeight])

    // Ne s'occupe QUE du serveur : les changements du formulaire sont appliqués dans le
    // useMemo plus haut.
    const getParticipants = useCallback(async () => {
        //log("participantsURL: ", participantsUrl)
        if (!participantsUrl) {
            setParticipantsServeur([])
            return
        }
        try {
            const response = await api.get(participantsUrl)
            //log('participants', response.data)
            
            setParticipantsServeur(response.data.participants)
        } catch (error) {
            log('getParticipants', error)
            catcher(error, t('events.errors.participantsLoadFailed'))
        }
    }, [participantsUrl])

    // Nathan (remove a participant): an editor can remove a participant. Philip: only in
    // the form, saved with its ✓ — a participant already in the event is marked to be
    // removed (retirerParticipant), a friend just added is dropped (supprimerInvite).
    const Line = useCallback(({ participant, aInviter = false } : { participant: Participant, aInviter?: boolean }) => {
        const existant = idsServeur.has(participant.id)
        return (
            <View key={participant.id} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                <ParticipantLigne
                    participant={participant}
                    height={LINE_HEIGHT}
                    peutGererParticipants={peutGererParticipants}
                    existant={existant}
                    aInviter={aInviter}
                    onRetirer={existant ? retirerParticipant : supprimerInvite}
                />
            </View>
        )
    }, [idsServeur, peutGererParticipants, retirerParticipant, supprimerInvite])

    const showMoreModal = useMemo(() => (
        <FlatList
            data={participants}
            keyExtractor={(item, index) => `FL-${item.id}-${index}`}
            renderItem={({ item }) => 
                <Line participant={item}/>
            }
        />
    ), [participants, Line])

    useEffect(() => {
            setDataRendererContent(DATA_RENDERER_KEY, showMoreModal)
            setDismissButton(checkMark(colors))   
        }, [showMoreModal, setDataRendererContent, setDismissButton, colors])

    useEffect(() => () => {
        removeDataRenderContent(DATA_RENDERER_KEY)
        resetDismissButton()
    }, [])

    // useFocusEffect s'exécute aussi au montage : plus besoin d'un useEffect en plus.
    useFocusEffect(useCallback(() => {
        log(availableFriendIds)
        getParticipants()
    }, [getParticipants]))

    return(
        <Animated.View style={[s.container, { backgroundColor: colors.card }, animatedContainer]}>
            <Text style={{ fontFamily: fonts.body, color: colors.muted, marginBottom:8, fontSize:20 }}>{t('events:form.participants')} - {participants.length}</Text>
            {participantsTruncated.map(p => (
               <Line key={`${p.id}`} participant={p}/>
            ))}   
            {showMore &&
                <LinkAbs href={{ pathname: "/(modals)/dataRenderer", params: { key: DATA_RENDERER_KEY, title:t('events:form.participants') } }} style={{ alignSelf: 'center', marginBottom:8, marginTop:4 }}>
                    {t('common:showMore')}
                </LinkAbs>
            }
            {/* Friends picked in the form, not invited yet (no status icon), above the +
                that added them: their X drops them at once. */}
            {aInviter.map(p => (
                <Line key={`inviter-${p.id}`} participant={p} aInviter />
            ))}
            {nbRetraits > 0 && (
                <Text style={[s.noteRetraits, { fontFamily: fonts.body, color: colors.muted }]}>
                    {t('events:form.removedOnConfirm', { count: nbRetraits })}
                </Text>
            )}
            {/* Philip — user story 9: what the status icons mean. */}
            {afficherLegende && <LegendeStatutsInvitation />}
            {/* The friends picked are only added to the form: invited with its ✓, the
                created event's (POST /evenements) or the edited one's. Philip. */}
            {peutGererParticipants && (
                <TouchableOpacity style={[s.inviter]}
                    onPress={() => {
                        router.push({
                            pathname: '/(modals)/listeAmis',
                            params: {
                                type: listType,
                                // Participants and friends already picked: not offered again.
                                excludedFriendIds: JSON.stringify([...participants, ...aInviter].map(participant => participant.id)),
                                availableFriendIds: JSON.stringify(availableFriendIds),
                                hasMoreFriends: String(friendsHasMore),
                            },
                        })
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('friends:list.invite')}
                >
                    <Ionicons name='add' color={colors.text} size={56}/>
                </TouchableOpacity>
            )}
        </Animated.View>
    )
}

