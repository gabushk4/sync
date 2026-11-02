import Icon from '@react-native-vector-icons/ionicons'
import * as Clipboard from 'expo-clipboard'
import { useFocusEffect } from 'expo-router'
import { DateTime } from 'luxon'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import ToastAbs from '@/abstractions/toastAbs'
import { toastTypes } from '@/constants/toastConfig'
import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'

/**
 * Loi 25 — demandes des membres, dans le dashboard admin :
 *  - 'export' (story #29) : GET /admin/exports, POST /admin/exports/:id
 *  - 'suppression' (story #30) : GET /admin/anonymise_requests, POST /admin/anonymise_requests/:id
 *
 * L'admin voit le membre, la date et le statut de chaque demande, la lance, et peut relancer
 * une demande échouée. Une anonymisation demande une confirmation (elle est définitive).
 */
export type TypeDemande = 'export' | 'suppression'

type Statut = 'en_attente' | 'en_cours' | 'confirmee' | 'completee' | 'echouee'

type Demande = {
    id_publique: string
    statut: Statut
    pseudo: string | null
    membre_id: string | null
    temps_creation: string | null
    updated_at: string | null
    // export
    email_demandeur?: string
    tentatives?: number
    derniere_erreur?: string | null
    expiration?: string | null
    // suppression
    courriel_demandeur?: string
    courriel_confirme?: boolean
    admin_pseudo?: string | null
}

const URLS: Record<TypeDemande, string> = {
    export: '/admin/exports',
    suppression: '/admin/anonymise_requests',
}

/** Une demande que l'admin peut lancer maintenant (ou relancer) */
function peutLancer(type: TypeDemande, statut: Statut) {
    if (type === 'export') return statut === 'en_attente' || statut === 'confirmee' || statut === 'echouee'
    return statut === 'confirmee' || statut === 'echouee'
}

type Props = {
    type: TypeDemande
    /** 401/403 : le parent sort du dashboard */
    onAccesRefuse: () => void
}

export default function DemandesLoi25({ type, onAccesRefuse }: Props) {
    const { t, i18n } = useTranslation('profile')
    const { api } = useAPI()
    const { colors } = usePalette()
    const { fonts } = useFont()

    const [demandes, setDemandes] = useState<Demande[]>([])
    const [etat, setEtat] = useState<'chargement' | 'pret' | 'erreur'>('chargement')
    const [rafraichissement, setRafraichissement] = useState(false)
    // demande en train d'être lancée (un seul traitement à la fois)
    const [enCours, setEnCours] = useState<string | null>(null)

    const cle = type === 'export' ? 'admin.exports' : 'admin.deletions'

    const charger = useCallback(async (silencieux = false) => {
        if (!silencieux) setEtat('chargement')
        try {
            const { data } = await api.get(URLS[type])
            setDemandes(Array.isArray(data?.demandes) ? data.demandes : [])
            setEtat('pret')
        } catch (error: any) {
            const status = error?.response?.status
            if (status === 401 || status === 403) {
                onAccesRefuse()
                return
            }
            setEtat('erreur')
            catcher(error, t(`${cle}.loadFailed`))
        }
    }, [api, type, cle, t, onAccesRefuse])

    useFocusEffect(useCallback(() => {
        void charger()
    }, [charger]))

    const rafraichir = async () => {
        setRafraichissement(true)
        await charger(true)
        setRafraichissement(false)
    }

    const majStatut = (id: string, statut: Statut) =>
        setDemandes((liste) => liste.map((d) => d.id_publique === id ? { ...d, statut } : d))

    /** Lance (ou relance) la demande, puis recharge la liste pour avoir le statut du serveur */
    const lancer = async (demande: Demande) => {
        if (enCours) return
        setEnCours(demande.id_publique)
        if (type === 'export') majStatut(demande.id_publique, 'en_cours')
        try {
            const { data } = await api.post(`${URLS[type]}/${demande.id_publique}`, {})

            if (data?.download_link) {
                // le fichier est prêt mais le courriel n'est pas parti : l'admin transmet le lien
                Alert.alert(
                    t('admin.exports.emailFailedTitle'),
                    t('admin.exports.emailFailedMessage', { email: data.email ?? demande.email_demandeur }),
                    [
                        { text: t('admin.close'), style: 'cancel' },
                        {
                            text: t('admin.exports.copyLink'),
                            onPress: () => {
                                void Clipboard.setStringAsync(String(data.download_link))
                                ToastAbs.show({ type: toastTypes.success, text2: t('admin.exports.linkCopied') })
                            },
                        },
                    ]
                )
            } else {
                ToastAbs.show({ type: toastTypes.success, text2: t(`${cle}.done`) })
            }
        } catch (error: any) {
            const status = error?.response?.status
            if (status === 401 || status === 403) {
                onAccesRefuse()
                return
            }
            catcher(error, t(`${cle}.failed`))
        } finally {
            setEnCours(null)
            await charger(true)
        }
    }

    /** L'anonymisation est définitive : on demande de confirmer */
    const confirmerAnonymisation = (demande: Demande) => {
        Alert.alert(
            t('admin.deletions.confirmTitle'),
            t('admin.deletions.confirmMessage', { pseudo: demande.pseudo ?? demande.courriel_demandeur ?? '' }),
            [
                { text: t('admin.cancel'), style: 'cancel' },
                { text: t('admin.deletions.confirmAction'), style: 'destructive', onPress: () => void lancer(demande) },
            ]
        )
    }

    const formaterDate = (iso: string | null | undefined) => {
        if (!iso) return t('admin.unknown')
        const dt = DateTime.fromISO(iso)
        return dt.isValid ? dt.setLocale(i18n.language).toLocaleString(DateTime.DATETIME_MED) : iso
    }

    const couleurStatut = (statut: Statut) => {
        switch (statut) {
            case 'completee': return colors.secondary
            case 'echouee': return colors.error
            case 'en_cours': return colors.text
            default: return colors.muted
        }
    }

    const s = StyleSheet.create({
        liste: { padding: 16, paddingBottom: 32, gap: 12, flexGrow: 1 },
        carte: { padding: 16, borderRadius: 12, backgroundColor: colors.card, gap: 6 },
        entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
        pseudo: { flexShrink: 1, color: colors.text, fontFamily: fonts.title, fontSize: 16 },
        pastille: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
        texteStatut: { fontFamily: fonts.body, fontSize: 12 },
        meta: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
        erreur: { color: colors.error, fontFamily: fonts.body, fontSize: 13 },
        bouton: {
            marginTop: 8, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8, paddingHorizontal: 16,
        },
        texteBouton: { color: colors.text, fontFamily: fonts.title, fontSize: 15 },
        message: { padding: 24, color: colors.muted, fontFamily: fonts.body, fontSize: 16, textAlign: 'center' },
        retry: { color: colors.secondary, fontFamily: fonts.title, fontSize: 15, textAlign: 'center' },
        centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    })

    if (etat === 'chargement') {
        return <View style={s.centre}><ActivityIndicator color={colors.secondary} /></View>
    }

    if (etat === 'erreur') {
        return (
            <TouchableOpacity onPress={() => void charger()} accessibilityRole="button">
                <Text style={s.message}>{t(`${cle}.loadFailed`)}</Text>
                <Text style={s.retry}>{t('admin.retry')}</Text>
            </TouchableOpacity>
        )
    }

    const renderDemande = ({ item }: { item: Demande }) => {
        const statutAffiche = type === 'suppression' && item.statut === 'en_attente'
            ? t('admin.deletions.waitingEmail')
            : t(`admin.statuses.${item.statut}`)
        const lancable = peutLancer(type, item.statut)
        const occupe = enCours === item.id_publique
        const courriel = type === 'export' ? item.email_demandeur : item.courriel_demandeur
        const destructif = type === 'suppression'

        return (
            <View style={s.carte}>
                <View style={s.entete}>
                    <Text style={s.pseudo} numberOfLines={1}>
                        {item.pseudo ? `@${item.pseudo}` : t('admin.unknownMember')}
                    </Text>
                    <View
                        style={[s.pastille, { borderColor: couleurStatut(item.statut) }]}
                        accessibilityLabel={t('admin.statusLabel', { statut: statutAffiche })}
                    >
                        <Text style={[s.texteStatut, { color: couleurStatut(item.statut) }]}>{statutAffiche}</Text>
                    </View>
                </View>

                {courriel ? <Text style={s.meta}>{courriel}</Text> : null}
                <Text style={s.meta}>{t('admin.requestedAt', { date: formaterDate(item.temps_creation) })}</Text>

                {type === 'export' && (item.tentatives ?? 0) > 0 && (
                    <Text style={s.meta}>{t('admin.exports.attempts', { count: item.tentatives })}</Text>
                )}
                {type === 'export' && item.statut === 'completee' && item.expiration && (
                    <Text style={s.meta}>{t('admin.exports.linkExpires', { date: formaterDate(item.expiration) })}</Text>
                )}
                {type === 'suppression' && item.statut === 'completee' && item.admin_pseudo && (
                    <Text style={s.meta}>{t('admin.deletions.doneBy', { pseudo: item.admin_pseudo })}</Text>
                )}
                {item.statut === 'echouee' && item.derniere_erreur ? (
                    <Text style={s.erreur} numberOfLines={3}>{item.derniere_erreur}</Text>
                ) : null}

                {lancable && (
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !!enCours, busy: occupe }}
                        disabled={!!enCours}
                        onPress={() => destructif ? confirmerAnonymisation(item) : void lancer(item)}
                        style={[
                            s.bouton,
                            { backgroundColor: destructif ? 'transparent' : colors.secondary },
                            destructif && { borderWidth: 1, borderColor: colors.error },
                            !!enCours && !occupe && { opacity: 0.5 },
                        ]}
                    >
                        {occupe ? (
                            <ActivityIndicator color={destructif ? colors.error : colors.text} />
                        ) : (
                            <>
                                <Icon
                                    name={item.statut === 'echouee' ? 'refresh' : destructif ? 'trash-outline' : 'download-outline'}
                                    size={18}
                                    color={destructif ? colors.error : colors.text}
                                />
                                <Text style={[s.texteBouton, destructif && { color: colors.error }]}>
                                    {item.statut === 'echouee' ? t('admin.relaunch') : t(`${cle}.launch`)}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        )
    }

    return (
        <FlatList
            data={demandes}
            keyExtractor={(d) => d.id_publique}
            renderItem={renderDemande}
            contentContainerStyle={s.liste}
            refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={colors.secondary} />}
            ListEmptyComponent={<Text style={s.message}>{t(`${cle}.empty`)}</Text>}
        />
    )
}
