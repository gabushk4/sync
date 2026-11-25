import Icon from '@react-native-vector-icons/ionicons'
import { router, useFocusEffect, useLocalSearchParams, useNavigation, useSegments } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import ImageChargement from '@/components/imageChargement'
import ToastAbs from '@/abstractions/toastAbs'
import BoutonAjouterAmi, { RelationAmitie } from '@/components/boutonAjouterAmi'
import ProfilPic from '@/components/pfp'
import VisionneusePhotos from '@/components/visionneusePhotos'
import { chargerPhotosConversation } from '@/functions/photosConversation'
import { PhotoEvenement } from '@/types/albumEvenement'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import { useConversations } from '@/contextes/contexteConversations'
import { useFont } from '@/contextes/contexteFont'
import { useMembre } from '@/contextes/contexteMembre'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import { convertUTCToLocal } from '@/functions/convertirUTCenLocal'
import { convertirTimestampDateLongue, convertirTimestampHeure, convertirTimestampJourCourt } from '@/functions/convertirTimestamp'

/** Photos shown in the info screen (3 rows of 3) */
const MAX_PHOTOS_INFOS = 9
const ESPACE_GRILLE = 2

/** GET /conversations/:id */
type InfosConversation = {
    id: string
    titre: string | null
    couverture_url: string | null
    cree_le: string | null
    mon_role: 'editeur' | 'lecteur'
    evenement: { id: string, titre: string, debut: string, fin: string } | null
    participants: {
        id: string
        pseudo: string
        fp_url: string | null
        role: 'editeur' | 'lecteur'
        moi: boolean
        /** friend or not: "add friend" button next to the others */
        relation?: RelationAmitie
        demande_id?: string | null
    }[]
}

/**
 * A conversation's info, opened by tapping its title (like Messenger): its picture
 * and name, the event it belongs to (story #21) and its members with their role.
 * A one-to-one chat shows the friend's profile instead of the members, and deletes the
 * conversation on my side only.
 * A member opens their profile, the event opens its page. Used in the inbox stack
 * and in the home stack (event conversation opened from the event's page): each
 * screen opened from here stays in the same stack, so back arrows return here.
 *
 * @returns {JSX.Element}
 */
export default function InfosConversationEcran() {
    const { t } = useTranslation('inbox')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { api, APIBaseURL } = useAPI()
    const { membre } = useMembre()
    const { conversationId } = useLocalSearchParams<{ conversationId: string }>()
    const dansAccueil = (useSegments() as string[]).includes('home')

    const [infos, setInfos] = useState<InfosConversation | null>(null)
    const [erreur, setErreur] = useState(false)
    const navigation = useNavigation()
    const { rafraichirConversations, effacerConversation } = useConversations()
    const [suppressionEnCours, setSuppressionEnCours] = useState(false)
    // Photos sent in the conversation: the latest in a grid here, all of them one tap away
    const [photos, setPhotos] = useState<PhotoEvenement[]>([])
    const [indexPhoto, setIndexPhoto] = useState<number | null>(null)
    const [largeurGrille, setLargeurGrille] = useState(0)

    /**
     * Deletes the conversation (its admins), after a confirmation: messages included, for
     * every member. An event's conversation can be created again from the event's page.
     * Then back past the deleted conversation's screen (to the list, or to the event).
     */
    const supprimer = () => {
        Alert.alert(t('infos.deleteTitle'), t(infos?.evenement ? 'infos.deleteMessageEvent' : 'infos.deleteMessage'), [
            { text: t('infos.cancel'), style: 'cancel' },
            {
                text: t('infos.deleteConfirm'),
                style: 'destructive',
                onPress: async () => {
                    setSuppressionEnCours(true)
                    try {
                        await api.delete(`/conversations/${encodeURIComponent(conversationId)}`)
                        ToastAbs.show({ type: toastTypes.success, text2: t('infos.deleted') })
                        rafraichirConversations()
                        // this screen and the conversation's
                        navigation.dispatch({ type: 'POP', payload: { count: 2 } })
                    } catch (error) {
                        catcher(error, t('infos.deleteFailed'))
                    } finally {
                        setSuppressionEnCours(false)
                    }
                },
            },
        ])
    }

    /**
     * One-to-one chat: deleted on my side only, after a confirmation (like swiping it in
     * the list): the friend keeps it, and writing again starts from an empty conversation.
     * Then back past the conversation's screen.
     */
    const supprimerDeMonCote = (nomAmi: string) => {
        Alert.alert(t('delete.title'), t('delete.message', { nom: nomAmi }), [
            { text: t('delete.cancel'), style: 'cancel' },
            {
                text: t('delete.confirm'),
                style: 'destructive',
                onPress: async () => {
                    setSuppressionEnCours(true)
                    try {
                        await effacerConversation(conversationId)
                        navigation.dispatch({ type: 'POP', payload: { count: 2 } })
                    } catch (error) {
                        catcher(error, t('delete.failed'))
                    } finally {
                        setSuppressionEnCours(false)
                    }
                },
            },
        ])
    }

    useFocusEffect(useCallback(() => {
        let actif = true
        chargerPhotosConversation(api, conversationId)
            .then((liste) => { if (actif) setPhotos(liste) })
            .catch((error) => { if (actif) catcher(error, t('photos.loadFailed')) })
        api.get(`/conversations/${encodeURIComponent(conversationId)}`)
            .then(({ data }) => {
                if (!actif) return
                setInfos(data)
                setErreur(false)
            })
            .catch((error) => {
                if (!actif) return
                setErreur(true)
                catcher(error, t('infos.loadFailed'))
            })
        return () => { actif = false }
    }, [api, conversationId, t]))

    const local = (iso: string) => convertUTCToLocal(iso, membre?.timezone)

    const ouvrirProfil = (id: string) => {
        router.push({
            pathname: dansAccueil ? '/(tabs)/home/profil/[membreId]' : '/(tabs)/inbox/profil/[membreId]',
            params: { membreId: id },
        } as any)
    }

    const ouvrirToutesLesPhotos = () => {
        router.push({
            pathname: dansAccueil ? '/(tabs)/home/conversation/photos/[conversationId]' : '/(tabs)/inbox/photos/[conversationId]',
            params: { conversationId },
        } as any)
    }

    const ouvrirEvenement = () => {
        if (!infos?.evenement) return
        router.push({
            pathname: '/(tabs)/home/details/[eventId]',
            params: {
                eventId: infos.evenement.id,
                start: local(infos.evenement.debut).toISO(),
                end: local(infos.evenement.fin).toISO(),
            },
        } as any)
    }

    const s = StyleSheet.create({
        page: { flexGrow: 1, padding: 20, gap: 20, backgroundColor: colors.background },
        titrePhotos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -12, marginHorizontal: 4 },
        voirTout: { flexDirection: 'row', alignItems: 'center', gap: 2 },
        grille: { flexDirection: 'row', flexWrap: 'wrap', gap: ESPACE_GRILLE },
        voile: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
        texteVoile: { color: 'white', fontFamily: fonts.title, fontSize: 20 },
        entete: { alignItems: 'center', gap: 8 },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 22, textAlign: 'center' },
        sousTitre: { color: colors.muted, fontFamily: fonts.body, fontSize: 15 },
        section: { color: colors.muted, fontFamily: fonts.title, fontSize: 14, marginBottom: -12, marginLeft: 4 },
        carte: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' },
        ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
        separateur: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 66 },
        texte: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 16 },
        detail: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
        role: { color: colors.secondary, fontFamily: fonts.body, fontSize: 13 },
        icone: { width: 40, height: 40, borderRadius: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
        centre: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
        supprimer: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.error,
            backgroundColor: colors.card,
        },
        texteSupprimer: { color: colors.error, fontFamily: fonts.body, fontSize: 17 },
    })

    if (!infos) {
        return (
            <View style={s.centre}>
                {erreur
                    ? <Text style={s.sousTitre}>{t('infos.loadFailed')}</Text>
                    : <ActivityIndicator color={colors.text} />}
            </View>
        )
    }

    const autres = infos.participants.filter((p) => !p.moi)
    // Same name as the conversation list: the title, else the other members' pseudos.
    // An event's conversation (story #21): "<event>'s group chat".
    const nom = infos.evenement
        ? t('infos.eventGroup', { titre: infos.evenement.titre })
        : infos.titre || autres.map((p) => p.pseudo).join(', ') || t('infos.you')
    const photo = infos.couverture_url ?? (autres.length === 1 ? autres[0].fp_url : null)
    const groupe = infos.participants.length > 2 || !!infos.titre || !!infos.evenement
    // one-to-one chat: the friend (none if they left)
    const ami = groupe ? undefined : autres[0]

    const plageEvenement = (debut: string, fin: string) => {
        const d = local(debut)
        const f = local(fin)
        // formats.json helpers: Luxon's month names ('LLL') come out as "null" on the phone
        return f.hasSame(d, 'day')
            ? `${convertirTimestampJourCourt(d)} · ${convertirTimestampHeure(d)} – ${convertirTimestampHeure(f)}`
            : `${convertirTimestampJourCourt(d)} ${convertirTimestampHeure(d)} – ${convertirTimestampJourCourt(f)} ${convertirTimestampHeure(f)}`
    }

    return (
        <ScrollView contentContainerStyle={s.page}>
            <View style={s.entete}>
                <ProfilPic size={96} pfp={photo ?? undefined} />
                <Text style={s.titre}>{nom}</Text>
                <Text style={s.sousTitre}>
                    {groupe ? t('infos.members', { count: infos.participants.length }) : `@${autres[0]?.pseudo ?? ''}`}
                </Text>
            </View>

            {/* Story #21: the event this conversation belongs to */}
            {infos.evenement && (
                <>
                    <Text style={s.section}>{t('infos.event')}</Text>
                    <TouchableOpacity style={[s.carte, s.ligne]} onPress={ouvrirEvenement} accessibilityRole="button">
                        <View style={s.icone}>
                            <Icon name="calendar-outline" size={20} color={colors.text} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.texte} numberOfLines={1}>{infos.evenement.titre}</Text>
                            <Text style={s.detail}>{plageEvenement(infos.evenement.debut, infos.evenement.fin)}</Text>
                        </View>
                        <Icon name="chevron-forward" size={20} color={colors.muted} />
                    </TouchableOpacity>
                </>
            )}

            {/* One-to-one chat: the friend's profile (and "add friend" if you no longer are) */}
            {ami && (
                <>
                    <Text style={s.section}>{t('infos.profile')}</Text>
                    <TouchableOpacity
                        style={[s.carte, s.ligne]}
                        onPress={() => ouvrirProfil(ami.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t('infos.openProfile', { pseudo: ami.pseudo })}
                    >
                        <View style={s.icone}>
                            <Icon name="person-outline" size={20} color={colors.text} />
                        </View>
                        <Text style={s.texte} numberOfLines={1}>{t('infos.viewProfile')}</Text>
                        {ami.relation && ami.relation !== 'ami' && (
                            <BoutonAjouterAmi
                                key={`${ami.id}-${ami.relation}`}
                                membreId={ami.id}
                                relation={ami.relation}
                                demandeId={ami.demande_id}
                                compact
                            />
                        )}
                        <Icon name="chevron-forward" size={20} color={colors.muted} />
                    </TouchableOpacity>
                </>
            )}

            {groupe && <Text style={s.section}>{t('infos.membersTitle', { count: infos.participants.length })}</Text>}
            {groupe && <View style={s.carte}>
                {infos.participants.map((p, index) => {
                    const contenu = (
                        <>
                            <ProfilPic size={40} pfp={p.fp_url ?? undefined} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.texte} numberOfLines={1}>
                                    {p.pseudo}{p.moi ? ` (${t('infos.you')})` : ''}
                                </Text>
                                {p.role === 'editeur' && groupe && <Text style={s.role}>{t('infos.admin')}</Text>}
                            </View>
                            {!p.moi && p.relation && p.relation !== 'ami' && (
                                <BoutonAjouterAmi
                                    key={`${p.id}-${p.relation}`}
                                    membreId={p.id}
                                    relation={p.relation}
                                    demandeId={p.demande_id}
                                    compact
                                />
                            )}
                            {!p.moi && <Icon name="chevron-forward" size={20} color={colors.muted} />}
                        </>
                    )
                    return (
                        <View key={p.id}>
                            {index > 0 && <View style={s.separateur} />}
                            {p.moi
                                ? <View style={s.ligne}>{contenu}</View>
                                : (
                                    <TouchableOpacity
                                        style={s.ligne}
                                        onPress={() => ouvrirProfil(p.id)}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('infos.openProfile', { pseudo: p.pseudo })}
                                    >
                                        {contenu}
                                    </TouchableOpacity>
                                )}
                        </View>
                    )
                })}
            </View>}

            {/* Photos sent in the conversation: up to 9 here (the 9th shows how many more),
                "See all" for the whole album */}
            {photos.length > 0 && (
                <>
                    <View style={s.titrePhotos}>
                        <Text style={[s.section, { marginBottom: 0 }]}>{t('photos.section', { count: photos.length })}</Text>
                        <TouchableOpacity onPress={ouvrirToutesLesPhotos} hitSlop={8} style={s.voirTout} accessibilityRole="button">
                            <Text style={s.detail}>{t('photos.seeAll')}</Text>
                            <Icon name="chevron-forward" size={14} color={colors.muted} />
                        </TouchableOpacity>
                    </View>
                    <View
                        style={[s.carte, s.grille]}
                        onLayout={(e) => setLargeurGrille(e.nativeEvent.layout.width)}
                    >
                        {largeurGrille > 0 && photos.slice(0, MAX_PHOTOS_INFOS).map((p, i) => {
                            const cote = (largeurGrille - ESPACE_GRILLE * 2) / 3
                            const reste = photos.length - MAX_PHOTOS_INFOS
                            const derniere = i === MAX_PHOTOS_INFOS - 1 && reste > 0
                            return (
                                <TouchableOpacity
                                    key={p.id}
                                    onPress={() => (derniere ? ouvrirToutesLesPhotos() : setIndexPhoto(i))}
                                    accessibilityRole="imagebutton"
                                    accessibilityLabel={derniere ? t('photos.seeAll') : t('photos.open', { pseudo: p.auteur.pseudo })}
                                    style={{ width: cote, height: cote, backgroundColor: colors.border }}
                                >
                                    <ImageChargement source={{ uri: `${APIBaseURL}${p.url}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                                    {derniere && (
                                        <View style={s.voile}>
                                            <Text style={s.texteVoile}>+{reste + 1}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </>
            )}

            {/* One-to-one chat: deleted on my side only (the friend keeps it) */}
            {!groupe && (
                <TouchableOpacity
                    style={s.supprimer}
                    onPress={() => supprimerDeMonCote(ami?.pseudo ?? nom)}
                    disabled={suppressionEnCours}
                    accessibilityRole="button"
                    accessibilityState={{ busy: suppressionEnCours }}
                >
                    {suppressionEnCours
                        ? <ActivityIndicator color={colors.error} />
                        : <Icon name="trash-outline" size={22} color={colors.error} />}
                    <Text style={s.texteSupprimer}>{t('infos.deleteForMe')}</Text>
                </TouchableOpacity>
            )}

            {/* A group's admins can delete it for everyone (an event's can be created again
                from the event) */}
            {groupe && infos.mon_role === 'editeur' && (
                <TouchableOpacity
                    style={s.supprimer}
                    onPress={supprimer}
                    disabled={suppressionEnCours}
                    accessibilityRole="button"
                    accessibilityState={{ busy: suppressionEnCours }}
                >
                    {suppressionEnCours
                        ? <ActivityIndicator color={colors.error} />
                        : <Icon name="trash-outline" size={22} color={colors.error} />}
                    <Text style={s.texteSupprimer}>{t('infos.delete')}</Text>
                </TouchableOpacity>
            )}

            {infos.cree_le && (
                <Text style={[s.detail, { textAlign: 'center' }]}>
                    {t('infos.createdOn', { date: convertirTimestampDateLongue(local(infos.cree_le)) })}
                </Text>
            )}
            <VisionneusePhotos photos={photos} indexDepart={indexPhoto} onFermer={() => setIndexPhoto(null)} />
        </ScrollView>
    )
}
