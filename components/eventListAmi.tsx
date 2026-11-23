import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, SectionList, Text, TouchableOpacity, useColorScheme, View, } from 'react-native';

import catcher from "@/functions/catcher";
import { convertirTimestampDateCourte, convertirTimestampHeure } from "@/functions/convertirTimestamp";
import { convertUTCToLocal } from "@/functions/convertirUTCenLocal";

import { useAPI } from "@/contextes/contexteAPI";
import { useFont } from "@/contextes/contexteFont";
import { useInvites } from "@/contextes/contexteInvites";
import { usePalette } from "@/contextes/contextePalette";

import ModalBase from "@/components/modalBase";

import { friendsAvailabilityEvents } from "@/events/friendsAvailabilityEvents";
import { modalEvents } from "@/events/modalEvents";
import { useFriendList } from "@/hooks/useFriendList";

import { ListType } from "@/app/(modals)/listeAmis";
import { useEventDraft } from "@/contextes/contexteEventDraft";
import { paramsPlage } from "@/functions/evenementsMembre";
import log from "@/functions/log";
import { Participant } from "@/types/invites";
import { DateTime } from "luxon";
import Ionicons from "@react-native-vector-icons/ionicons";
import FriendLine from "./friendLine";

export type FriendAPIRes = {
    temps_amitie: string,
    id_publique: string,
    pseudo: string,
    // GET /amis sends the photo as `fp_url` (see sync_api routes/amis.js), not `pfp_url`.
    fp_url: string | null
}

function EventListAmiContent() {
    const { t } = useTranslation('friends')
    const { api } = useAPI()
    const { colors } = usePalette()
    const { fonts } = useFont()
    const colorScheme = useColorScheme()
    const { invites } = useInvites()
    const { start, end, friendsSuggestions } = useEventDraft()

    const { type, hasMoreFriends: hasMoreFriendsParam, excludedFriendIds: excludedFriendIdsParam } = useLocalSearchParams() as { type: ListType; hasMoreFriends: string; excludedFriendIds?: string }
    const select = type === 'select' || type === 'event'
    const excludedFriendIds = useMemo(() => {
        const raw = Array.isArray(excludedFriendIdsParam) ? excludedFriendIdsParam[0] : excludedFriendIdsParam
        if (!raw) return []
        try {
            const parsed: unknown = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
        } catch {
            return []
        }
    }, [excludedFriendIdsParam])
    const [hasMoreFriends, setHasMoreFriends] = useState(
        (Array.isArray(hasMoreFriendsParam) ? hasMoreFriendsParam[0] : hasMoreFriendsParam) === 'true'
    )
    const [loadingMoreFriends, setLoadingMoreFriends] = useState(false)

    const icones = {
        profilDef: colorScheme === 'dark' ? require('@/assets/icones/profil-dark-icon.png') : require('@/assets/icones/profil-light-icon.png'),
        ajouterAmi: colorScheme === 'dark' ? require('@/assets/icones/ajouter-ami-dark-icon.png') : require('@/assets/icones/ajouter-ami-dark-icon.png'),
        supprimerAmi: colorScheme === 'dark' ? require('@/assets/icones/corbeille-dark-icon.png') : require('@/assets/icones/corbeille-light-icon.png')
    }

    const [amis, setAmis] = useState<Participant[]>([])
    const [idsSelec, setIdsSelec] = useState(new Set())
    // Friends with an unavailability over the event's range: shown "unavailable then"
    // and can't be picked (the API would leave them out anyway). Philip — user story 20.
    const [idsIndisponibles, setIdsIndisponibles] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (!select) return
        let annule = false
        api.get('/disponibilites/indisponibles', { params: paramsPlage(start, end) })
            .then((reponse) => {
                if (annule) return
                const ids = new Set<string>(reponse.data?.amis ?? [])
                setIdsIndisponibles(ids)
                // Already picked before the range changed: unpicked.
                setIdsSelec((prev) => new Set([...prev].filter((id) => !ids.has(id as string))))
            })
            .catch((error) => { if (!annule) catcher(error, t('errors.loadFailed')) })
        return () => { annule = true }
    }, [select, start, end])

    const getAmis = async () => {
        try {
            const response = await api.get('/amis')
            const data = response.data.map((ami: FriendAPIRes) => {
                const amitie = convertUTCToLocal(ami.temps_amitie)
                return {
                    ...ami,
                    id: ami.id_publique,
                    fp_url: ami.fp_url,
                    temps_amitie: amitie
                }
            })
            setAmis(data)
        } catch (error) {
            catcher(error, t('errors.loadFailed'))
        }
    }

    const onPressSelect = useFriendList('select')
    const onPressConsult = useFriendList('consult')

    // Friends picked in this modal (the ones already invited aren't in the list)
    const nbSelectionnes = useMemo(() => {
        const dejaInvites = new Set([...invites.map(invite => invite.id), ...excludedFriendIds])
        return [...idsSelec].filter(id => !dejaInvites.has(id as string)).length
    }, [idsSelec, invites, excludedFriendIds])
    // Only added to the form's pending invitations, created or edited event alike: they
    // are sent with the form's ✓ (an existing event's used to be invited right away).
    // Philip.
    const inviteAndDismiss = useCallback(() => {
        onPressSelect(amis.filter(ami => idsSelec.has(ami.id)))
    }, [amis, idsSelec, onPressSelect])

    useEffect(() => {
        if (!select) return

        const applyPage = (page: { hasMore: boolean }) => {
            log("hasMore", page.hasMore)
            setHasMoreFriends(page.hasMore)
        }

        const unsubscribe = friendsAvailabilityEvents.onPageUpdate(applyPage)
        const latestPage = friendsAvailabilityEvents.getLatestPage()
        if (latestPage) applyPage(latestPage)

        return unsubscribe
    }, [select])

    const friendSections = useMemo(() => {
        const friendsById = new Map(amis.map(friend => [friend.id, friend]))
        const invitedIds = new Set([...invites.map(invite => invite.id), ...excludedFriendIds])
        const intervalsByFriend = new Map(friendsSuggestions.map(friend => [friend.id, friend.intervales]))
        const disponibles = new Set<string>()
        for (const id of intervalsByFriend.keys()) {
            const intervals = intervalsByFriend.get(id) ?? []
            const complet = intervals.some(interval => interval.debut.toMillis() <= start.toMillis() && interval.fin.toMillis() >= end.toMillis())
            if (complet) disponibles.add(id)
        }
        const availableFriends = [...disponibles]
            // Unavailable then: not offered (Philip — user story 20).
            .filter(id => !invitedIds.has(id) && !idsIndisponibles.has(id))
            .map(id => friendsById.get(id))
            .filter((friend): friend is Participant => friend !== undefined)
            .map(friend => ({ ...friend, suggestedIntervals: [] }))
        const availableIds = new Set(availableFriends.map(friend => friend.id))
        const otherFriends = amis
            .filter(friend => !invitedIds.has(friend.id) && !availableIds.has(friend.id))
            .map(friend => ({ ...friend, suggestedIntervals: intervalsByFriend.get(friend.id) ?? [] }))

        const now = DateTime.now()
        const startDiffFromNow = Math.abs(now.startOf('day').diff(start.startOf('day'), 'days').days)
        log({startDiffFromNow})
        const startIsToday = startDiffFromNow < 1;
        const startIsThisWeek = startDiffFromNow < 7
        const endDiffFromNow = Math.abs(now.startOf('day').diff(end.startOf('day'), 'days').days)
        log({endDiffFromNow})
        const endIsToday = endDiffFromNow < 1;
        const endIsThisWeek = endDiffFromNow < 7 

        log({endIsThisWeek})

        const formatTimestamp = (dtIsToday: boolean, dtIsThisWeek: boolean, dt: DateTime) => 
            dtIsToday
                ? convertirTimestampHeure(dt)
                : dtIsThisWeek ? `${dt.weekdayLong} ${convertirTimestampHeure(dt)}` : `${convertirTimestampDateCourte(dt)} ${convertirTimestampHeure(dt)}`

        const stringStart = formatTimestamp(startIsToday, startIsThisWeek, start)
        
        const stringEnd = formatTimestamp(endIsToday, endIsThisWeek, end)

        return [
            { title: t('list.availableForSlot', {start: stringStart, end:stringEnd}), data: availableFriends, isAvailableSection: true },
            { title: t('list.otherFriends'), data: otherFriends, isAvailableSection: false },
        ]
    }, [amis, end, excludedFriendIds, friendsSuggestions, invites, start, t, idsIndisponibles])

    useFocusEffect(useCallback(() => {
        getAmis()
        if (select && invites.length > 0) {
            setIdsSelec(prev => {
                const next = new Set(prev)
                invites.forEach(invite => next.add(invite.id))
                return next
            })
        }
    }, []))



    return (
        // no ✓ in full screen: the Invite button below does its job
        <ModalBase afficherBoutonPleinEcran={!select}>
            <View style={{ height: '100%', width: '100%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                        <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 20 }}>{t('list.title')}</Text>
                    </View>
                </View>
                <LinearGradient
                    style={{ position: 'absolute', opacity: 0.3, zIndex: 2, top: 22, left: 0, width: '100%', height: 24 }}
                    start={{ x: 0, y: 0.2 }}
                    end={{ x: 0, y: 1 }}
                    colors={[colors.primary, 'transparent']}
                />
                {amis.length > 0 && <SectionList
                    sections={friendSections}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingTop: 12, paddingBottom: 16 }}
                    renderSectionHeader={({ section }) => (
                        <View style={{ width: '100%', backgroundColor: colors.card, paddingVertical: 4 }}>
                            <Text style={{
                                color: colors.muted,
                                fontFamily: fonts.title,
                                fontSize: 16,
                                paddingHorizontal: 8,
                                paddingTop: 12,
                                paddingBottom: 4,
                            }}>
                                {section.title}
                            </Text>
                        </View>
                    )}
                    renderSectionFooter={({ section }) => section.isAvailableSection ? (
                        <View>
                            {section.data.length === 0 && (
                                <Text style={{ color: colors.muted, fontFamily: fonts.body, paddingHorizontal: 8, paddingBottom: 8 }}>
                                    {t('list.noAvailableFriends')}
                                </Text>
                            )}
                            {select && hasMoreFriends && (
                                <TouchableOpacity
                                    disabled={loadingMoreFriends}
                                    onPress={async () => {
                                        if (loadingMoreFriends) return
                                        setLoadingMoreFriends(true)
                                        try {
                                            const page = await friendsAvailabilityEvents.requestMore()
                                            setHasMoreFriends(page.hasMore)
                                        } finally {
                                            setLoadingMoreFriends(false)
                                        }
                                    }}
                                    style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 8 }}
                                >
                                    {loadingMoreFriends
                                        ? <ActivityIndicator color={colors.muted} />
                                        : <Text style={{ color: colors.muted, fontFamily: fonts.body, textDecorationLine: 'underline' }}>{t('list.loadMore')}</Text>}
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : null}
                    renderItem={({ item }) => {
                        
                        const selectionne = select && idsSelec.has(item.id)
                        return (
                            <FriendLine friend={item} listType={type} selected={selectionne} indisponible={select && idsIndisponibles.has(item.id)} suggestedIntervals={item.suggestedIntervals ?? []} onPress={() => {
                                if (select) {
                                    setIdsSelec(prev => {
                                        const next = new Set(prev)
                                        if (next.has(item.id)) next.delete(item.id)
                                        else next.add(item.id)
                                        return next
                                    })
                                } else if (type === 'consult') {
                                    onPressConsult(item)
                                }
                            }}/>
                        )
                    }}
                />}
                {/* Confirm button, always visible: it replaces the ✓ of the full screen modal.
                    Closing the modal another way (tap outside, swipe down) cancels. */}
                {select && amis.length > 0 && (
                    <View style={{ paddingTop: 8, paddingBottom: 12 }}>
                        <TouchableOpacity
                            disabled={nbSelectionnes === 0}
                            onPress={() => {
                                inviteAndDismiss()
                                modalEvents.emitClosing()
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: nbSelectionnes === 0 }}
                            style={{
                                height: 48,
                                borderRadius: 12,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 8,
                                backgroundColor: nbSelectionnes > 0 ? colors.primary : colors.border,
                            }}
                        >
                            {nbSelectionnes > 0 && <Ionicons name='person-add' size={18} color="white" />}
                            <Text style={{ color: nbSelectionnes > 0 ? 'white' : colors.muted, fontFamily: fonts.title, fontSize: 16 }}>
                                {nbSelectionnes === 0
                                    ? t('list.pickFriends')
                                    : t('list.addCount', { count: nbSelectionnes })}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
                {amis.length < 1 &&
                    <View style={{ height: '100%', width: '100%', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: colors.text, fontFamily: fonts.title, fontSize: 18 }}>{t('list.emptyState')}</Text>
                        <TouchableOpacity onPress={() => router.push('/(modals)/ajouterAmi')}>
                            <Image source={icones.ajouterAmi} style={{ height: 64, width: 64 }} resizeMode="contain" />
                        </TouchableOpacity>
                    </View>
                }
            </View>
        </ModalBase>
    )
}

export default function EventFriendList() {
    return <EventListAmiContent />
}
