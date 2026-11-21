import axios from "axios";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { useAPI } from "@/contextes/contexteAPI";
import { useFont } from "@/contextes/contexteFont";
import { Notification, NotificationAction, useNotifications } from "@/contextes/contexteNotifications";
import { usePalette } from "@/contextes/contextePalette";

import catcher from "@/functions/catcher";
import categorieNotification from "@/functions/categorieNotification";
import { convertirTimestampDateCourte, convertirTimestampHeure, convertToWhen } from "@/functions/convertirTimestamp";
import { convertUTCToLocal } from "@/functions/convertirUTCenLocal";
import log from "@/functions/log";

import ToastAbs from "@/abstractions/toastAbs";
import { withSpringConfig, withTimingConfig } from "@/constants/ReanimatedConfs";
import { toastTypes } from "@/constants/toastConfig";
import AppIcon from "@/svgs/appIcon";
import Icon from "@react-native-vector-icons/ionicons";

import ouvrirRevueInvitation from "@/functions/ouvrirRevueInvitation";
import PanneauGestionEvenement from "@/components/panneauGestionEvenement";
import Spinner from "@/components/spinner";
import useDecisionInvitation from "@/hooks/useDecisionInvitation";
import useDetailsEvenement from "@/hooks/useDetailsEvenement";
import { bornesLocales, invitationDepuisDetails } from "@/types/invitation";

type ItemProps = {
    item: Notification
    index: number
    vu: string
}

/**
 * One notification card. Tapping expands it to show its expiration and, for an
 * invitation or friend request still awaiting an answer, accept/refuse buttons
 * (`item.actions`, resolved live by the API). Once answered, the buttons are
 * replaced by the answer ("accepted" / "refused").
 * Updated for user story 9 (accept/refuse an event invitation from a notification).
 * SUBJECT TO CHANGE: may be revised depending on how teammates implement their own user stories.
 *
 * @param {ItemProps} props
 * @returns {JSX.Element}
 */
export default function NotificationItem({ item, index, vu }: ItemProps) {
    const { t } = useTranslation('notifications')
    const { t: tFriends } = useTranslation('friends')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const colorScheme = useColorScheme()
    const { api, APIBaseURL } = useAPI()
    const { notifRefresh } = useNotifications()

    // An event invitation: accepting goes through the shared decision logic, which
    // checks the member's schedule (conflict screen, review of the schedules).
    // Philip — user story 8.
    const invitation = item.type === 'invitation_evenement' ? invitationDepuisDetails(item.details) : null
    const decision = useDecisionInvitation(invitation, {
        onRepondu: () => notifRefresh?.forceRefresh(),
        onVoirHoraire: () => invitation && ouvrirRevueInvitation(invitation),
    })

    // User story 9: the API sends type/actions/statuses at the notification's top
    // level; there's no `payload` anymore.
    const categorie = categorieNotification(item.type)
    const demandeAmiEnAttente = item.type === 'demande_ami' && item.statut_metier === 'en_attente'
    // A postponement vote: yes / no buttons (the actions); its answer reads
    // "available" / "not available". Philip — user story 23.
    const voteReport = item.type === 'postpone_vote'
    // Event the notification is about (the API sends it for every event notification).
    const idEvenement: string | null = categorie === 'evenements'
        ? (item.id_evenement ?? item.details?.id_evenement ?? null)
        : null
    const nonLue = item.statut_notification === "non_lue"

    // The event is loaded with the card, not on tapping it: whether it's already over
    // shows in the header, and the card unfolds with it ready (the invited occurrence's
    // bounds as strings, so a rebuilt `invitation` object doesn't reload it).
    // Philip — rectification (event managed from its notification).
    const bornesInvitation = invitation ? bornesLocales(invitation) : null
    const details = useDetailsEvenement(idEvenement, bornesInvitation?.debut?.toISO() ?? undefined, bornesInvitation?.fin?.toISO() ?? undefined)
    const evenementPasse = !!details.event?.fin && details.event.fin < DateTime.now()

    const [selectionner, setSelectionner] = useState(false)
    const [notificationsSelec, setNotificationsSelec] = useState<string[]>([])

    const [montrerDetails, setMontrerDetails] = useState<boolean>(false)
    // Message lines shown: more once unfolded. Derived, not a state set from the effect
    // below (the React Compiler lint rejects a synchronous setState in an effect).
    const lines = montrerDetails ? 4 : 2

    const icones = {
        corbeille:
            colorScheme === "dark"
                ? require("@/assets/icones/corbeille-dark-icon.png")
                : require("@/assets/icones/corbeille-light-icon.png"),
        accepter:
            colorScheme === "dark"
                ? require("@/assets/icones/checkmark-dark-icon.png")
                : require("@/assets/icones/checkmark-light-icon.png"),
        refuser:
            colorScheme === "dark"
                ? require("@/assets/icones/croix-dark-icon.png")
                : require("@/assets/icones/croix-light-icon.png"),
    }

    const heightMaxNotif = demandeAmiEnAttente ? 152 : 124
    const heightMinNotif = demandeAmiEnAttente ? 142 : 64

    const backgroundDef = selectionner ? colors.primary : colors.card

    const opaciteOptionsNotif = useSharedValue(0)
    const heightOptionsNotif = useSharedValue(1)
    const bottomOptionsNotif = useSharedValue(16)
    const heightNotif = useSharedValue(heightMinNotif)
    const backgroundColor = useSharedValue(backgroundDef)

    /**
     * Runs one of the notification's actions (e.g. accept/refuse an event
     * invitation via PATCH /evenements/invitations/:id), then refreshes the
     * notifications so the answer replaces the buttons — and, for a refusal,
     * so the notification moves to the refused invitations page (user story 9).
     *
     * @param {string} method - HTTP method of the action.
     * @param {string} url - API path of the action.
     * @param {Object} [body] - Request body (e.g. `{ statut: 'acceptee' }`).
     * @returns {Promise<void>}
     */
    const actionnerNotif = async (method: string, url: string, body: any = undefined) => {
        log("actionner notif", {method, url, body})
        // Invitations: both answers go through the decision logic (conflict check on
        // accept, spinner, no double sending). Philip — user story 8.
        if (invitation && body?.statut === 'acceptee') return decision.accepter()
        if (invitation && body?.statut === 'refusee') return decision.refuser()
        try {
            const response = await requeteAction(method, url, body)

            log("reponse en actionnant la notif", response.data)

            if (response.status === 200) {
                notifRefresh?.forceRefresh()
                ToastAbs.show({
                    type: toastTypes.success,
                    text2: response.data.message,
                })
            }
        } catch (error: any) {
            log("une erreur en actionnant la notif", error)
            catcher(error, t('errors.actionFailed'))
        }
    }

    /**
     * Sends one of the notification's actions through the shared API instance so
     * its response interceptor can refresh an expired access token and retry.
     *
     * @param {string} method - HTTP method of the action.
     * @param {string} url - API path of the action.
     * @param {Object} [body] - Request body.
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    const requeteAction = async (method: string, url: string, body: any = undefined) => {
        return api.request({
            method,
            url,
            data: body,
        })
    }

    /**
     * Deletes the given notifications (soft delete server-side), then refreshes the list.
     *
     * @param {string[]} ids - Public ids of the notifications to delete.
     * @returns {Promise<void>}
     */
    const supprNotif = async (ids: string[] = []) => {
        if (ids.length === 0) {
            return
        }
        try {
            ids.forEach(async (id) =>
                axios.delete(`/notifications/${id}`, {
                    baseURL: APIBaseURL
                })
            )
            notifRefresh?.forceRefresh()
            setNotificationsSelec((prev) => prev.filter((current) => !ids.includes(current)))            
        } catch (err) {
            log("erreur en supprimant une notif", err)
            catcher(err, t('errors.deleteFailed'))
        }

        
    }

    const notifAnime = useAnimatedStyle(() => {
        "worklet"
        return {
            height: heightNotif.get(),
            backgroundColor: backgroundColor.get(),
        }
    })

    // An event notification is one block that grows with its content (no fixed height).
    const fondAnime = useAnimatedStyle(() => {
        "worklet"
        return {
            backgroundColor: backgroundColor.get(),
        }
    })

    const optionsNotifAnime = useAnimatedStyle(() => {
        "worklet"
        return {
            opacity: opaciteOptionsNotif.get(),
            height: heightOptionsNotif.get(),
            bottom: bottomOptionsNotif.get(),
        }
    })

    const typeLabel = t(`types.${categorie}`)

    const montrerDetailsNotif = () => {
        heightNotif.set(withTiming(heightMaxNotif, withTimingConfig))
        opaciteOptionsNotif.set(withTiming(1, withTimingConfig))
        heightOptionsNotif.set(withTiming(40, withTimingConfig))
        bottomOptionsNotif.set(withSpring(-8, withSpringConfig))
    }

    const masquerDetailsNotif = () => {
        heightNotif.set(withTiming(heightMinNotif, withTimingConfig))
        opaciteOptionsNotif.set(withTiming(0, { duration: 150 }))
        heightOptionsNotif.set(withTiming(1, withTimingConfig))
        bottomOptionsNotif.set(withSpring(16, withSpringConfig))
    }

    const selectNotif = () => {
        setNotificationsSelec((prev) => [...prev, item.id])
        backgroundColor.set(withTiming(colors.secondary, { duration: 500 }))
    }

    const typeIcon = () => {
        if (item.icon) {
            return <Icon name={item.icon as any} color={colors.muted} size={20} />
        }
        switch (categorie) {
            case "amis":
                return <Icon name="person-outline" color={colors.muted} size={20} />
            case "sync":
                return <AppIcon fill={colors.muted} size={20} />
            case "evenements":
                return <Icon name="calendar-clear-outline" color={colors.muted} size={20} />
            default:
                return null
        }
    }

    useEffect(() => {
        //log("montrer details ", item.id, montrerDetails)
        if (montrerDetails === true) {
            montrerDetailsNotif()
        } else if (montrerDetails === false) {
            masquerDetailsNotif()
        }
        // Only when unfolded / folded: the two animations are recreated on every render,
        // as dependencies they would restart on each one (e.g. while the card loads).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [montrerDetails])

    let expired = false
    if (item.expiration === "expired") expired = true

    // Unfolded, an event notification is managed right in the card (PanneauGestionEvenement)
    // instead of opening the details page: the decision while the invitation awaits an
    // answer, else the actions of the member's role. Philip — rectification (user story 23).
    const invitationEnAttente = invitation && item.statut_metier === 'en_attente' && !expired ? invitation : null
    // Never answered, and now too late to.
    const invitationExpiree = !!invitation && item.statut_metier === 'en_attente' && expired
    // Accepted, then left (the API reads it from the participation): nothing to do anymore.
    // Philip — rectification.
    const evenementQuitte = item.statut_metier === 'annulee'
    // The API sends "expired" instead of a date once the invitation has expired
    // (sync_api validateExpiration.js); convertUTCToLocal throws on it and crashed the list.
    const expiration = item.expiration && !expired ? convertUTCToLocal(item.expiration) : undefined

    // Header label, seen without unfolding the card: the event is over, the invitation /
    // request expired, or when it will (only while unanswered). Philip — rectification.
    const enAttenteDeReponse = item.statut_metier !== 'acceptee' && item.statut_metier !== 'refusee' && !evenementQuitte
    let expirationLabel: string | undefined
    if (evenementPasse)
        expirationLabel = t('expiration.eventPastShort')
    else if (expired && enAttenteDeReponse)
        expirationLabel = t('expiration.expired')
    else if (expiration && enAttenteDeReponse) {
        const expirationNowDiff = expiration.diff(DateTime.now(), 'days').days
        expirationLabel = t('expiration.expires', {
            quand: expirationNowDiff < 1 ? convertirTimestampHeure(expiration) : convertirTimestampDateCourte(expiration),
        })
    }
    const expirationAtteinte = evenementPasse || expired

    const s = StyleSheet.create({
        container: {
            marginVertical: 4,
            width: "100%",
            zIndex: 2,
        },
        notif: {
            width: "100%",
            paddingBottom: 4,
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: nonLue ? 2 : 1,
            borderColor: colors.border,
        },
        timestamp: {
            color: colors.muted,
            fontFamily: fonts.number,
        },
        unreadFlag: {
            backgroundColor: colors.secondary,
            height: 8,
            aspectRatio: 1 / 1,
            borderRadius: 100,
            position: "absolute",
            right: 8,
            top: "32%",
        },
        optionBouton: {
            marginHorizontal: 4,
            height: "100%",
            width: 40,
            borderRadius: 100,
            borderWidth: 1,
            alignItems: "center",
            justifyContent: "center",
            marginBottom:4
        },
        reponse: {
            fontFamily: fonts.body,
            fontSize: 16,
            marginHorizontal: 8,
        },
    })
    
    // User story 9: the API only sends actions while the invitation/request awaits an
    // answer and hasn't expired, so no "already answered" handling is needed here.
    const options = (item.actions ?? []).map((action: NotificationAction) => {
        const buttonColor = action.label === "accepter" ? colors.success : colors.error

        return (
            <TouchableOpacity
                key={`${item.id}-${action.label}`}
                style={[
                    s.optionBouton,
                    {
                        zIndex: 1,
                        borderColor: buttonColor,
                    },
                ]}
                onPress={() => {
                    actionnerNotif(action.method, action.url, action.body)
                }}
                disabled={!!decision.enCours}
            >
                {/* Spinner on the answer being sent. Philip — user story 8. */}
                {decision.enCours && decision.enCours === action.body?.statut
                    ? <Spinner size={22} color={buttonColor} />
                    : action.icon
                        ? <Icon name={action.icon as any} color={buttonColor} size={24} />
                        : action.label === "accepter"
                        ? <Icon name="checkmark" color={buttonColor} size={28} />
                        : <Icon name='close' color={buttonColor} size={28}/>
                }
                
            </TouchableOpacity>
        )
    })

    const actionsDemandeAmi = demandeAmiEnAttente
        ? (item.actions ?? []).filter((action) => action.label === 'accepter' || action.label === 'refuser').map((action) => {
            const accepter = action.label === 'accepter'
            const couleur = accepter ? colors.success : colors.error
            return (
                <TouchableOpacity
                    key={`${item.id}-${action.label}-inline`}
                    accessibilityRole="button"
                    accessibilityLabel={accepter ? tFriends('requests.accept') : tFriends('requests.decline')}
                    style={{
                        flex: 1,
                        minHeight: 40,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: couleur,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        backgroundColor: colors.card,
                    }}
                    onPress={() => actionnerNotif(action.method, action.url, action.body)}
                    disabled={!!decision.enCours}
                >
                    {action.icon
                        ? <Icon name={action.icon as any} color={couleur} size={20} />
                        : accepter
                            ? <Icon name="checkmark" color={couleur} size={20} />
                            : <Icon name="close" color={couleur} size={20} />}
                    <Text style={{ color: couleur, fontFamily: fonts.body, fontSize: 15 }}>
                        {accepter ? tFriends('requests.accept') : tFriends('requests.decline')}
                    </Text>
                </TouchableOpacity>
            )
        })
        : null

    // User story 9: once answered, show the answer instead of the buttons.
    // Pending is shown too for an event notification (Philip — user story 23).
    // 'annulee': the member left the event (Philip — rectification).
    const statut = (item.statut_metier === "acceptee" || item.statut_metier === "refusee" || evenementQuitte
        || (idEvenement && item.statut_metier === "en_attente")) ? (
        <Text style={[s.reponse, {
            color: item.statut_metier === "acceptee" ? colors.success
                : item.statut_metier === "refusee" ? colors.error
                : evenementQuitte ? colors.muted : colors.warning,
        }]}>
            {t(`${voteReport ? 'vote' : 'answer'}.${item.statut_metier}`)}
        </Text>
    ) : null

    // An event card's own buttons (a postponement vote's yes / no); an invitation's
    // answer is in its panel instead.
    const boutonsVisibles = !invitation && options.length > 0

    const corbeille = (style: object) => (
        <TouchableOpacity onPress={() => supprNotif([item.id])} style={[{ position: "relative", right: 0, backgroundColor: colors.error, borderColor: colors.border }, style]}>
            <Image source={icones.corbeille} style={{ width: "80%", height: "80%" }} resizeMode="contain" />
        </TouchableOpacity>
    )

    return (
        <View style={s.container}>
            {decision.conflit}
            <Animated.View
                style={[idEvenement ? fondAnime : notifAnime, s.notif]}
                layout={idEvenement ? LinearTransition.duration(200) : undefined}
            >
                <View
                    style={{
                        height: 32,
                        backgroundColor: colors.background,
                        paddingVertical: 4,
                        paddingHorizontal: 8,
                        flexDirection: "row",
                        justifyContent: "space-between",
                    }}
                >
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        {typeIcon()}
                        <Text style={{ color: colors.muted, fontSize: 18, fontFamily: fonts.title, letterSpacing: 0.7 }}>
                            {typeLabel}
                        </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        {expirationLabel && (
                            <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
                                <Icon name="time-outline" color={expirationAtteinte ? colors.error : colors.warning} size={14} />
                                <Text style={[s.timestamp, { color: expirationAtteinte ? colors.error : colors.warning }]}>
                                    {expirationLabel}
                                </Text>
                            </View>
                        )}
                        <Text style={s.timestamp}>
                            {/* convertUTCToLocal throws without a date, so the `??` fallback never
                                ran and one notification without date crashed the whole feed.
                                Rectification (Philip). */}
                            {convertToWhen(item.date_envoie ? convertUTCToLocal(item.date_envoie) : DateTime.now().toLocal()) as string}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        // An event notification unfolds in place: status, then its details and
                        // choices, all in this one block (Philip — user story 23 / rectification).
                        if (!selectionner) {
                            setMontrerDetails(!montrerDetails)
                        } else {
                            if (!notificationsSelec.includes(item.id)) {
                                selectNotif()
                            } else {
                                const nouvNotifSelec = notificationsSelec.filter((id) => id !== item.id)
                                if (nouvNotifSelec.length === 0) setSelectionner(false)
                                setNotificationsSelec(nouvNotifSelec)
                            }
                        }
                    }}
                    onLongPress={() => {
                        setSelectionner(true)
                        selectNotif()
                    }}
                    style={idEvenement
                        ? { flexDirection: "row", justifyContent: "space-between", minHeight: 32 }
                        : {
                            flex: demandeAmiEnAttente ? 0 : 1,
                            flexDirection: "row",
                            justifyContent: "space-between",
                            height: demandeAmiEnAttente ? 48 : "80%",
                        }}
                >
                    <View style={{ paddingVertical: 4, paddingHorizontal: 8, ...(idEvenement ? { flex: 1, paddingRight: 20 } : { height: "100%" }) }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontFamily: fonts.body, fontWeight: nonLue ? "bold" : "100" }} numberOfLines={lines}>
                            {item.message}
                        </Text>
                    </View>
                    {nonLue && <View style={s.unreadFlag} />}
                </TouchableOpacity>
                {demandeAmiEnAttente && (
                    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 10, paddingBottom: 6 }}>
                        {actionsDemandeAmi}
                    </View>
                )}
                {/* Unfolded event notification: status, then the details / choices, inside
                    the card itself (Philip — rectification). */}
                {idEvenement && montrerDetails && !selectionner && (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(150)}
                        style={{ borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginTop: 4 }}
                    >
                        {/* A postponement vote's yes / no (an invitation's accept / refuse are
                            in the panel below): their own row, with the status. Otherwise the
                            status sits on the date's line in the panel — no empty row between
                            the message and the date. No trash on an event's card (same card
                            whatever the notification; its delete didn't work, see HANDOFF):
                            a long press still selects it to delete. */}
                        {boutonsVisibles && (
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 8 }}>
                                {statut ?? <View />}
                                <View style={{ flexDirection: "row", alignItems: "center", height: 36 }}>
                                    {options}
                                </View>
                            </View>
                        )}
                        {/* An invitation of the event's old time (moved since by a vote): it
                            doesn't work anymore, the newer notification is the one to answer. */}
                        {item.remplacee ? (
                            <Text style={[s.reponse, { color: colors.muted, paddingVertical: 8 }]}>
                                {t('expiration.replaced')}
                            </Text>
                        ) : (
                            <PanneauGestionEvenement
                                idEvenement={idEvenement}
                                event={details.event}
                                erreur={details.erreur}
                                recharger={details.recharger}
                                passe={evenementPasse}
                                invitation={invitationEnAttente}
                                invitationExpiree={invitationExpiree}
                                quitte={evenementQuitte}
                                decision={decision}
                                onTermine={() => notifRefresh?.forceRefresh()}
                                statut={boutonsVisibles ? undefined : statut}
                            />
                        )}
                    </Animated.View>
                )}
            </Animated.View>
            {/* Other notifications: their answer / buttons under the card, as before. */}
            {!idEvenement && (
                <Animated.View
                    style={[
                        optionsNotifAnime,
                        {
                            position: "relative",
                            width: "100%",
                            justifyContent: "space-between",
                            flexDirection: "row",
                            paddingHorizontal: 16,
                        },
                    ]}
                >
                    <View />
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {statut}
                        {!demandeAmiEnAttente && options}
                        {corbeille({})}
                    </View>
                </Animated.View>
            )}
        </View>
    )
}
