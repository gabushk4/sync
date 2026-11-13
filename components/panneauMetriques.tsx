/**
 * Panneau de métriques d'usage — onglet "Metriques" du dashboard admin (US #36).
 */
import { DateTime } from 'luxon'
import { useFocusEffect } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native'
import Icon from '@react-native-vector-icons/ionicons'

import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import { convertUTCToLocal } from '@/functions/convertirUTCenLocal'
import { convertToWhen } from '@/functions/convertirTimestamp'
import RenderHueColor from '@/functions/renderHueColor'
import PanneauCollapsable from './PanneauCollapsable'

type TauxGlobaux = {
    taux_acceptation_invitations: number
    taux_maj_30j: number
    taux_activation: number
    taux_evenements_dispo_commune: number
}

type PeriodeCourante = {
    membres_actives: number
    evenements_crees: number
    evenements_dispo_commune: number
    invitations_envoyees: number
    invitations_acceptees: number
    taux_acceptation_invitations: number
    taux_activation: number
    taux_evenements_dispo_commune: number
}

type PeriodeJour = PeriodeCourante & { debut: DateTime; fin: DateTime }

type Details = TauxGlobaux & {
    periode_courante: PeriodeCourante
    par_jour_7j?: PeriodeJour
    par_jour_30j?: PeriodeJour
}

type ResponseMetrique = {
    metrics: MetriqueBrut[]
}

type MetriqueBrut = {
    calcule_le: string
    population: number
    membres_actives: number
    evenements_crees: number
    evenements_dispo_commune: number
    invitations_envoyees: number
    invitations_acceptees: number
    membres_horaire_maj_30j: number
    details: Details
}

/** Version camel-case des clés API, telle qu'affichée dans le panneau. */
type Metrique = {
    calculeLe: DateTime
    population: number
    membresActives: number
    evenementsCrees: number
    evenementsDispoCommune: number
    invitationsEnvoyees: number
    invitationsAcceptees: number
    membresHoraireMaj_30j: number
    details: Details
}

type Etat = 'chargement' | 'pret' | 'erreur'

type Props = {
    /** 401/403 : le parent (dashboard admin) sort du dashboard. */
    onAccesRefuse: () => void
}

type LigneStat = {
    label: string
    valeur: string
    /** Taux auquel cette stat appartient (détermine sa couleur de fond). */
    taux?: 'activation' | 'acceptation' | 'maj30j' | 'dispoCommune'
}

/** HUE par type de taux (cohérent avec la palette de couleurs des calendriers). */
const HUE_PAR_TAUX: Record<string, number> = {
    activation: 145,   // vert
    acceptation: 270,  // violet
    maj30j: 35,        // orange
    dispoCommune: 185, // cyan / bleu
}

type BadgeTauxProps = {
    label: string
    valeur: string
    type: 'activation' | 'acceptation' | 'maj30j' | 'dispoCommune'
    scheme: 'light' | 'dark'
}

function BadgeTaux({ label, valeur, type, scheme }: BadgeTauxProps) {
    const hue = HUE_PAR_TAUX[type]
    const fond = RenderHueColor(hue, scheme, 'fond')
    const couleur = RenderHueColor(hue, scheme, 'texte')

    const s = StyleSheet.create({
        racine: {
            flex: 2,
            alignItems: 'center',
            gap: 4,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: fond,
            height: 88,

        },
        label: { flex:1, color: couleur, fontFamily: 'Karla-Medium', fontSize: 11 },
        valeur: { flex:1, color: couleur, fontFamily: 'Nunito-Light', fontSize: 16 },
    })

    return (
        <View style={s.racine}>
            <Text style={s.label}>{label}</Text>
            <Text style={s.valeur}>{valeur}</Text>
        </View>
    )
}

function StatLine({ label, valeur, taux, scheme }: LigneStat & { scheme: 'light' | 'dark' }) {
    const { colors } = usePalette()
    const { fonts } = useFont()

    const hue = taux ? HUE_PAR_TAUX[taux] : null
    const fond = hue ? RenderHueColor(hue, scheme, 'fond') : undefined
    const couleurLabel = hue ? RenderHueColor(hue, scheme, 'texte') : undefined

    const s = StyleSheet.create({
        racine: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: fond,
            marginBottom: 4,
        },
        label: { color: couleurLabel ?? colors.muted, fontFamily: fonts.body, fontSize: 13, flex: 1 },
        valeur: { color: colors.text, fontFamily: fonts.number, fontSize: 13 },
    })

    return (
        <View style={s.racine}>
            <Text style={s.label} numberOfLines={1}>
                {label}
            </Text>
            <Text style={s.valeur}>{valeur}</Text>
        </View>
    )
}

export default function PanneauMetriques({ onAccesRefuse }: Props) {
    const { t, i18n } = useTranslation('profile')
    const { api } = useAPI()
    const { colors } = usePalette()
    const { fonts } = useFont()
    const scheme = useColorScheme() ?? 'light'

    const [metriques, setMetriques] = useState<Metrique[]>([])
    const [etat, setEtat] = useState<Etat>('chargement')
    const [rafraichissement, setRafraichissement] = useState(false)

    const formaterNombre = (value: number) => value ? value.toLocaleString(i18n.language) : '---'
    const formaterTaux = (value: number) =>
        value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'

    const charger = useCallback(async (silencieux = false) => {
        if (!silencieux) setEtat('chargement')
        try {
            const { data } = await api.get<ResponseMetrique>('/admin/metrics')
            const liste = Array.isArray(data.metrics) ? data.metrics : []
            setMetriques(
                liste.map((res) => ({
                    calculeLe: convertUTCToLocal(res.calcule_le),
                    population: res.population,
                    membresActives: res.membres_actives,
                    evenementsCrees: res.evenements_crees,
                    evenementsDispoCommune: res.evenements_dispo_commune,
                    invitationsEnvoyees: res.invitations_envoyees,
                    membresHoraireMaj_30j: res.membres_horaire_maj_30j,
                    invitationsAcceptees: res.invitations_acceptees,
                    details: {
                        ...res.details,
                        ...(res.details.par_jour_7j && {
                            par_jour_7j: {
                                ...res.details.par_jour_7j,
                                debut: convertUTCToLocal(res.details.par_jour_7j.debut),
                                fin: convertUTCToLocal(res.details.par_jour_7j.fin)
                            }
                        }),
                        ...(res.details.par_jour_30j && {
                            par_jour_30j: {
                                ...res.details.par_jour_30j,
                                debut: convertUTCToLocal(res.details.par_jour_30j.debut),
                                fin: convertUTCToLocal(res.details.par_jour_30j.fin)
                            }
                        })
                    }
                }))
            )
            setEtat('pret')
        } catch (error: any) {
            const status = error?.response?.status
            if (status === 401 || status === 403) {
                onAccesRefuse()
                return
            }
            setEtat('erreur')
            catcher(error, t('admin.metrics.loadFailed'))
        }
    }, [api, t, onAccesRefuse])

    const rafraichir = async () => {
        setRafraichissement(true)
        await charger(true)
        setRafraichissement(false)
    }

    useFocusEffect(useCallback(() => {
        void charger()
    }, [charger]))

    const s = StyleSheet.create({
        page: { flex: 1, backgroundColor: colors.background },
        entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 18 },
        boutonRefresh: { padding: 8, borderRadius: 20 },
        tauxHeader: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 10,
        },
        centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
        message: { padding: 24, color: colors.muted, fontFamily: fonts.body, fontSize: 16, textAlign: 'center' },
        retry: { color: colors.secondary, fontFamily: fonts.title, fontSize: 15, textAlign: 'center', marginTop: 8 },
        liste: { paddingBottom: 32 },
    })

    const dernier = metriques[0]!

    return (
        <View style={s.page}>
            {/* En-tête : titre + bouton d'actualisation (toujours accessible) */}
            <View style={s.entete}>
                <Text style={s.titre}>{t('admin.metrics.title')}</Text>
                <TouchableOpacity onPress={rafraichir} accessibilityRole="button" accessibilityLabel={t('admin.metrics.refresh')} style={s.boutonRefresh}>
                    <Icon name={rafraichissement ? 'refresh' : 'refresh-outline'} size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Taux globaux en grille 2×2 (uniquement quand les données sont prêtes) */}
            {etat === 'pret' && dernier && (
                <View style={s.tauxHeader}>
                    <BadgeTaux
                        label={t('admin.metrics.tauxActivation')}
                        valeur={formaterTaux(dernier.details.taux_activation)}
                        type="activation"
                        scheme={scheme}
                    />
                    <BadgeTaux
                        label={t('admin.metrics.tauxAcceptationInvitations')}
                        valeur={formaterTaux(dernier.details.taux_acceptation_invitations)}
                        type="acceptation"
                        scheme={scheme}
                    />
                    <BadgeTaux
                        label={t('admin.metrics.tauxMaj30j')}
                        valeur={formaterTaux(dernier.details.taux_maj_30j)}
                        type="maj30j"
                        scheme={scheme}
                    />
                    <BadgeTaux
                        label={t('admin.metrics.tauxEvenementsDispoCommune')}
                        valeur={formaterTaux(dernier.details.taux_evenements_dispo_commune)}
                        type="dispoCommune"
                        scheme={scheme}
                    />
                </View>
            )}

            {/* Etat : chargement */}
            {etat === 'chargement' && (
                <View style={s.centre}>
                    <ActivityIndicator color={colors.secondary} />
                </View>
            )}

            {/* Etat : erreur (avec bouton de rechargement) */}
            {etat === 'erreur' && (
                <View style={s.centre}>
                    <Text style={s.message}>{t('admin.metrics.loadFailed')}</Text>
                    <TouchableOpacity onPress={() => void charger()} accessibilityRole="button">
                        <Text style={s.retry}>{t('admin.metrics.retry')}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Etat : vide */}
            {etat === 'pret' && metriques.length === 0 && (
                <View style={s.centre}>
                    <Text style={s.message}>{t('admin.metrics.empty')}</Text>
                </View>
            )}

            {/* Contenu quand les données sont prêtes */}
            {etat === 'pret' && dernier && (
                <>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={s.liste}
                        refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={colors.secondary} />}
                    >
                        {/* Dernier calcul */}
                        <PanneauCollapsable titre={t('admin.metrics.dernierCalcul')} sousTitre={convertToWhen(dernier.calculeLe).toString()} ouvertParDefaut={true}>
                            <StatLine label={t('admin.metrics.population')} valeur={formaterNombre(dernier.population)} scheme={scheme} />
                            <StatLine label={t('admin.metrics.membresActives')} valeur={formaterNombre(dernier.membresActives)} taux="activation" scheme={scheme} />
                            <StatLine label={t('admin.metrics.evenementsCrees')} valeur={formaterNombre(dernier.evenementsCrees)} taux="dispoCommune" scheme={scheme} />
                            <StatLine label={t('admin.metrics.evenementsDispoCommune')} valeur={formaterNombre(dernier.evenementsDispoCommune)} taux="dispoCommune" scheme={scheme} />
                            <StatLine label={t('admin.metrics.invitationsEnvoyees')} valeur={formaterNombre(dernier.invitationsEnvoyees)} taux="acceptation" scheme={scheme} />
                            <StatLine label={t('admin.metrics.invitationsAcceptees')} valeur={formaterNombre(dernier.invitationsAcceptees)} taux="acceptation" scheme={scheme} />
                            <StatLine label={t('admin.metrics.membresHoraireMaj')} valeur={formaterNombre(dernier.membresHoraireMaj_30j)} taux="maj30j" scheme={scheme} />
                        </PanneauCollapsable>

                        {/* Période courante (delta depuis le précédent instantané) */}
                        {dernier.details.periode_courante && (
                            <PanneauCollapsable titre={t('admin.metrics.periodeCourante')}>
                                <StatLine label={t('admin.metrics.membresActives')} valeur={formaterNombre(dernier.details.periode_courante.membres_actives)} taux="activation" scheme={scheme} />
                                <StatLine label={t('admin.metrics.evenementsCrees')} valeur={formaterNombre(dernier.details.periode_courante.evenements_crees)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.evenementsDispoCommune')} valeur={formaterNombre(dernier.details.periode_courante.evenements_dispo_commune)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.invitationsEnvoyees')} valeur={formaterNombre(dernier.details.periode_courante.invitations_envoyees)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.invitationsAcceptees')} valeur={formaterNombre(dernier.details.periode_courante.invitations_acceptees)} scheme={scheme} />
                            </PanneauCollapsable>
                        )}

                        {/* Moyenne sur 7 jours */}
                        {dernier.details.par_jour_7j && (
                            <PanneauCollapsable titre={t('admin.metrics.parJour7j')} sousTitre={t('admin.metrics.periode', { debut: convertToWhen(dernier.details.par_jour_7j.debut).toString(), fin: convertToWhen(dernier.details.par_jour_7j.fin).toString() })}>
                                <StatLine label={t('admin.metrics.membresActives')} valeur={formaterNombre(dernier.details.par_jour_7j.membres_actives)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.evenementsCrees')} valeur={formaterNombre(dernier.details.par_jour_7j.evenements_crees)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.evenementsDispoCommune')} valeur={formaterNombre(dernier.details.par_jour_7j.evenements_dispo_commune)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.invitationsEnvoyees')} valeur={formaterNombre(dernier.details.par_jour_7j.invitations_envoyees)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.invitationsAcceptees')} valeur={formaterNombre(dernier.details.par_jour_7j.invitations_acceptees)} scheme={scheme} />
                            </PanneauCollapsable>
                        )}

                        {/* Moyenne sur 30 jours */}
                        {dernier.details.par_jour_30j && (
                            <PanneauCollapsable titre={t('admin.metrics.parJour30j')} sousTitre={t('admin.metrics.periode', { debut: convertToWhen(dernier.details.par_jour_30j.debut).toString(), fin: convertToWhen(dernier.details.par_jour_30j.fin).toString() })}>
                                <StatLine label={t('admin.metrics.membresActives')} valeur={formaterNombre(dernier.details.par_jour_30j.membres_actives)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.evenementsCrees')} valeur={formaterNombre(dernier.details.par_jour_30j.evenements_crees)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.evenementsDispoCommune')} valeur={formaterNombre(dernier.details.par_jour_30j.evenements_dispo_commune)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.invitationsEnvoyees')} valeur={formaterNombre(dernier.details.par_jour_30j.invitations_envoyees)} scheme={scheme} />
                                <StatLine label={t('admin.metrics.invitationsAcceptees')} valeur={formaterNombre(dernier.details.par_jour_30j.invitations_acceptees)} scheme={scheme} />
                            </PanneauCollapsable>
                        )}
                    </ScrollView>

                    {/* Historique des instantanés précédents */}
                    {metriques.length > 1 && (
                        <PanneauCollapsable titre={t('admin.metrics.histoire')}>
                            <FlatList
                                data={metriques.slice(1)}
                                keyExtractor={(_, index) => String(index)}
                                renderItem={({ item }) => (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12 }}>{convertToWhen(item.calculeLe).toString()}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 16 }}>
                                            <Text style={{ color: colors.text, fontFamily: fonts.number, fontSize: 13 }}>{formaterNombre(item.membresActives)}</Text>
                                            <Text style={{ color: colors.text, fontFamily: fonts.number, fontSize: 13 }}>{formaterTaux(item.details.taux_activation)}</Text>
                                        </View>
                                    </View>
                                )}
                                contentContainerStyle={{ paddingHorizontal: 16 }}
                            />
                        </PanneauCollapsable>
                    )}
                </>
            )}
        </View>
    )
}
