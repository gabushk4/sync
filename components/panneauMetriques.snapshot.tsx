/**
 * Panneau de métriques d'usage — onglet "Metriques" du dashboard admin (US #36).
 *
 * GET /admin/metrics retourne un tableau d'instantanés (le plus récent en premier).
 * Chaque instantané contient les compteurs bruts et un objet `details` avec les taux
 * calculés (acceptation invitations, mise à jour 30j, activation, événements dispo
 * commune), la période courante (delta depuis le dernier instantané) et les moyennes
 * sur 7 et 30 jours.
 *
 * Affiche l'instantané le plus récent en cartes, puis l'historique des instantanés
 * précédents. L'entête (titre + bouton d'actualisation) est toujours accessible,
 * même pendant le chargement, en erreur ou quand il n'y a aucune donnée.
 */
import { DateTime } from 'luxon'
import { useFocusEffect } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Icon from '@react-native-vector-icons/ionicons'

import { useAPI } from '@/contextes/contexteAPI'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import catcher from '@/functions/catcher'
import { convertUTCToLocal } from '@/functions/convertirUTCenLocal'
import { convertirTimestampDateCourte, convertToWhen } from '@/functions/convertirTimestamp'

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

export default function PanneauMetriques({ onAccesRefuse }: Props) {
    const { t, i18n } = useTranslation('profile')
    const { api } = useAPI()
    const { colors } = usePalette()
    const { fonts } = useFont()

    const [metriques, setMetriques] = useState<Metrique[]>([])
    const [etat, setEtat] = useState<Etat>('chargement')
    const [rafraichissement, setRafraichissement] = useState(false)


    const formaterNombre = (value: number) => value ? value.toLocaleString(i18n.language) : '---'
    const formaterTaux = (value: number) =>
        value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %'

    const charger = useCallback(async (silencieux = false) => {
        if (!silencieux) setEtat('chargement')
        try {
            const {data} = await api.get<ResponseMetrique>('/admin/metrics')
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

    /** Une ligne libellé / valeur dans une carte de métriques. */
    const ligne = (label: string, valeur: React.ReactNode) => (
        <View style={s.ligne}>
            <Text style={s.ligneLabel}>{label}</Text>
            <Text style={s.ligneValeur}>{valeur}</Text>
        </View>
    )

    /** Quatre taux affichés côte à côte. */
    const ligneTaux = (items: { label: string; valeur: string }[]) => (
        <View style={s.grilleTaux}>
            {items.map(({ label, valeur }, index) => (
                <View key={index} style={s.taux}>
                    <Text style={s.tauxLabel}>{label}</Text>
                    <Text style={s.tauxValeur}>{valeur}</Text>
                </View>
            ))}
        </View>
    )

    const s = StyleSheet.create({
        page: { flex: 1, backgroundColor: colors.background },
        liste: { padding: 16, paddingBottom: 32 },
        centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
        message: { padding: 24, color: colors.muted, fontFamily: fonts.body, fontSize: 16, textAlign: 'center' },
        retry: { color: colors.secondary, fontFamily: fonts.title, fontSize: 15, textAlign: 'center', marginTop: 8 },
        entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
        titre: { color: colors.text, fontFamily: fonts.title, fontSize: 18 },
        boutonRefresh: { padding: 8, borderRadius: 20 },
        carte: { padding: 16, borderRadius: 12, backgroundColor: colors.card, marginHorizontal: 16, gap: 10 },
        carteEntete: { gap: 4 },
        carteTitre: { color: colors.text, fontFamily: fonts.title, fontSize: 16 },
        carteSousTitre: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
        titresSection: { marginTop: 4 },
        tauxSectionLabel: { color: colors.muted, fontFamily: fonts.title, fontSize: 13, marginBottom: 6 },
        grille: { flexDirection: 'row', gap: 8 },
        stat: { flex: 1, alignItems: 'center', gap: 4 },
        statLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
        statValeur: { color: colors.text, fontFamily: fonts.number, fontSize: 17 },
        separateur: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 8 },
        ligne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
        ligneLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, flex: 1 },
        ligneValeur: { color: colors.text, fontFamily: fonts.number, fontSize: 13 },
        grilleTaux: { flexDirection: 'row', gap: 6 },
        taux: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.background },
        tauxLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
        tauxValeur: { color: colors.text, fontFamily: fonts.number, fontSize: 15 },
        titreSection: { color: colors.text, fontFamily: fonts.title, fontSize: 16, marginTop: 14, marginHorizontal: 16 },
        histoireListe: { paddingHorizontal: 16 },
        histoireLigne: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 7,
            paddingHorizontal: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            marginHorizontal: 16,
            backgroundColor: colors.card,
        },
        histoireCol: { flex: 1, alignItems: 'center', gap: 2 },
        histoireDate: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },
        histoireValeur: { color: colors.text, fontFamily: fonts.number, fontSize: 13 },
        histoireLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 9 },
    })

    const dernier = metriques[0]!

    return (
        <View style={s.page}>
            {/* En-tête : titre + bouton d'actualisation (toujours accessible) */}
            <View style={s.entete}>
                <Text style={s.titre}>{t('admin.metrics.title')}</Text>
                <TouchableOpacity onPress={rafraichir} accessibilityRole="button" accessibilityLabel={t('admin.metrics.refresh')} style={s.boutonRefresh}>
                    <Icon name={rafraichissement ? 'refresh' : 'refresh-outline'} size={22} color={colors.card} />
                </TouchableOpacity>
            </View>

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

            {/* Contenu quand les donnees sont pretes */}
            {etat === 'pret' && metriques.length > 0 && (
                <>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={s.liste}
                        refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={colors.secondary} />}
                    >
                        {/* Dernier instantané : compteurs bruts et taux globaux */}
                        <View style={s.carte}>
                            <View style={s.carteEntete}>
                                <Text style={s.carteTitre}>{t('admin.metrics.dernierCalcul')}</Text>
                                <Text style={s.carteSousTitre}>{t('admin.metrics.calculeLe', { date: convertToWhen(dernier.calculeLe) })}</Text>
                            </View>

                            <View style={s.grille}>
                                <View style={s.stat}>
                                    <Text style={s.statLabel}>{t('admin.metrics.population')}</Text>
                                    <Text style={s.statValeur}>{formaterNombre(dernier.population)}</Text>
                                </View>
                                <View style={s.stat}>
                                    <Text style={s.statLabel}>{t('admin.metrics.membresActives')}</Text>
                                    <Text style={s.statValeur}>{formaterNombre(dernier.membresActives)}</Text>
                                </View>
                                <View style={s.stat}>
                                    <Text style={s.statLabel}>{t('admin.metrics.evenementsCrees')}</Text>
                                    <Text style={s.statValeur}>{formaterNombre(dernier.evenementsCrees)}</Text>
                                </View>
                                <View style={s.stat}>
                                    <Text style={s.statLabel}>{t('admin.metrics.invitationsEnvoyees')}</Text>
                                    <Text style={s.statValeur}>{formaterNombre(dernier.invitationsEnvoyees)}</Text>
                                </View>
                            </View>

                            <View style={s.grille}>
                                <View style={s.stat}>
                                    <Text style={s.statLabel}>{t('admin.metrics.invitationsAcceptees')}</Text>
                                    <Text style={s.statValeur}>{formaterNombre(dernier.invitationsAcceptees)}</Text>
                                </View>
                                <View style={s.stat}>
                                    <Text style={s.statLabel}>{t('admin.metrics.membresHoraireMaj')}</Text>
                                    <Text style={s.statValeur}>{formaterNombre(dernier.membresHoraireMaj_30j)}</Text>
                                </View>
                                <View style={s.stat}>
                                    <Text style={s.statLabel}>{t('admin.metrics.evenementsDispoCommune')}</Text>
                                    <Text style={s.statValeur}>{formaterNombre(dernier.evenementsDispoCommune)}</Text>
                                </View>
                            </View>

                            <View style={s.separateur} />

                            <View style={s.titresSection}>
                                <Text style={s.tauxSectionLabel}>{t('admin.metrics.tauxGlobaux')}</Text>
                            </View>
                            {ligneTaux([
                                { label: t('admin.metrics.tauxActivation'), valeur: formaterTaux(dernier.details.taux_activation) },
                                { label: t('admin.metrics.tauxAcceptationInvitations'), valeur: formaterTaux(dernier.details.taux_acceptation_invitations) },
                                { label: t('admin.metrics.tauxMaj30j'), valeur: formaterTaux(dernier.details.taux_maj_30j) },
                                { label: t('admin.metrics.tauxEvenementsDispoCommune'), valeur: formaterTaux(dernier.details.taux_evenements_dispo_commune) },
                            ])}
                        </View>

                        {/* Période courante (delta depuis le précédent instantané) */}
                        {dernier.details.periode_courante && (
                            <View style={s.carte}>
                                <Text style={s.carteTitre}>{t('admin.metrics.periodeCourante')}</Text>
                                {ligne(t('admin.metrics.membresActives'), formaterNombre(dernier.details.periode_courante.membres_actives))}
                                {ligne(t('admin.metrics.evenementsCrees'), formaterNombre(dernier.details.periode_courante.evenements_crees))}
                                {ligne(t('admin.metrics.evenementsDispoCommune'), formaterNombre(dernier.details.periode_courante.evenements_dispo_commune))}
                                {ligne(t('admin.metrics.invitationsEnvoyees'), formaterNombre(dernier.details.periode_courante.invitations_envoyees))}
                                {ligne(t('admin.metrics.invitationsAcceptees'), formaterNombre(dernier.details.periode_courante.invitations_acceptees))}
                                <View style={s.separateur} />
                                {ligneTaux([
                                    { label: t('admin.metrics.tauxActivation'), valeur: formaterTaux(dernier.details.periode_courante.taux_activation) },
                                    { label: t('admin.metrics.tauxAcceptationInvitations'), valeur: formaterTaux(dernier.details.periode_courante.taux_acceptation_invitations) },
                                    { label: t('admin.metrics.tauxEvenementsDispoCommune'), valeur: formaterTaux(dernier.details.periode_courante.taux_evenements_dispo_commune) },
                                ])}
                            </View>
                        )}

                        {/* Moyenne sur 7 jours */}
                        {dernier.details.par_jour_7j && (
                            <View style={s.carte}>
                                <Text style={s.carteTitre}>{t('admin.metrics.parJour7j')}</Text>
                                <Text style={s.carteSousTitre}>
                                    {t('admin.metrics.periode', { debut: convertToWhen(dernier.details.par_jour_7j.debut), fin: convertToWhen(dernier.details.par_jour_7j.fin) })}
                                </Text>
                                {ligne(t('admin.metrics.membresActives'), formaterNombre(dernier.details.par_jour_7j.membres_actives))}
                                {ligne(t('admin.metrics.evenementsCrees'), formaterNombre(dernier.details.par_jour_7j.evenements_crees))}
                                {ligne(t('admin.metrics.evenementsDispoCommune'), formaterNombre(dernier.details.par_jour_7j.evenements_dispo_commune))}
                                {ligne(t('admin.metrics.invitationsEnvoyees'), formaterNombre(dernier.details.par_jour_7j.invitations_envoyees))}
                                {ligne(t('admin.metrics.invitationsAcceptees'), formaterNombre(dernier.details.par_jour_7j.invitations_acceptees))}
                                <View style={s.separateur} />
                                {ligneTaux([
                                    { label: t('admin.metrics.tauxActivation'), valeur: formaterTaux(dernier.details.par_jour_7j.taux_activation) },
                                    { label: t('admin.metrics.tauxAcceptationInvitations'), valeur: formaterTaux(dernier.details.par_jour_7j.taux_acceptation_invitations) },
                                    { label: t('admin.metrics.tauxEvenementsDispoCommune'), valeur: formaterTaux(dernier.details.par_jour_7j.taux_evenements_dispo_commune) },
                                ])}
                            </View>
                        )}

                        {/* Moyenne sur 30 jours */}
                        {dernier.details.par_jour_30j && (
                            <View style={s.carte}>
                                <Text style={s.carteTitre}>{t('admin.metrics.parJour30j')}</Text>
                                <Text style={s.carteSousTitre}>
                                    {t('admin.metrics.periode', { debut: convertToWhen(dernier.details.par_jour_30j.debut), fin: convertToWhen(dernier.details.par_jour_30j.fin) })}
                                </Text>
                                {ligne(t('admin.metrics.membresActives'), formaterNombre(dernier.details.par_jour_30j.membres_actives))}
                                {ligne(t('admin.metrics.evenementsCrees'), formaterNombre(dernier.details.par_jour_30j.evenements_crees))}
                                {ligne(t('admin.metrics.evenementsDispoCommune'), formaterNombre(dernier.details.par_jour_30j.evenements_dispo_commune))}
                                {ligne(t('admin.metrics.invitationsEnvoyees'), formaterNombre(dernier.details.par_jour_30j.invitations_envoyees))}
                                {ligne(t('admin.metrics.invitationsAcceptees'), formaterNombre(dernier.details.par_jour_30j.invitations_acceptees))}
                                <View style={s.separateur} />
                                {ligneTaux([
                                    { label: t('admin.metrics.tauxActivation'), valeur: formaterTaux(dernier.details.par_jour_30j.taux_activation) },
                                    { label: t('admin.metrics.tauxAcceptationInvitations'), valeur: formaterTaux(dernier.details.par_jour_30j.taux_acceptation_invitations) },
                                    { label: t('admin.metrics.tauxEvenementsDispoCommune'), valeur: formaterTaux(dernier.details.par_jour_30j.taux_evenements_dispo_commune) },
                                ])}
                            </View>
                        )}
                    </ScrollView>

                    {/* Historique des instantanés précédents */}
                    {metriques.length > 1 && (
                        <>
                            <Text style={s.titreSection}>{t('admin.metrics.histoire')}</Text>
                            <FlatList
                                data={metriques.slice(1)}
                                keyExtractor={(_, index) => String(index)}
                                renderItem={({ item }) => (
                                    <View style={s.histoireLigne}>
                                        <View style={s.histoireCol}>
                                            <Text style={s.histoireDate}>{convertToWhen(item.calculeLe)}</Text>
                                            <Text style={s.histoireValeur}>{formaterNombre(item.population)}</Text>
                                        </View>
                                        <View style={s.histoireCol}>
                                            <Text style={s.histoireLabel}>{t('admin.metrics.membresActives')}</Text>
                                            <Text style={s.histoireValeur}>{formaterNombre(item.membresActives)}</Text>
                                        </View>
                                        <View style={s.histoireCol}>
                                            <Text style={s.histoireLabel}>{t('admin.metrics.evenementsCrees')}</Text>
                                            <Text style={s.histoireValeur}>{formaterNombre(item.evenementsCrees)}</Text>
                                        </View>
                                        <View style={s.histoireCol}>
                                            <Text style={s.histoireLabel}>{t('admin.metrics.invitationsEnvoyees')}</Text>
                                            <Text style={s.histoireValeur}>{formaterNombre(item.invitationsEnvoyees)}</Text>
                                        </View>
                                        <View style={s.histoireCol}>
                                            <Text style={s.histoireLabel}>{t('admin.metrics.tauxActivation')}</Text>
                                            <Text style={s.histoireValeur}>{formaterTaux(item.details.taux_activation)}</Text>
                                        </View>
                                    </View>
                                )}
                                contentContainerStyle={s.histoireListe}
                                ItemSeparatorComponent={() => <View style={s.separateur} />}
                            />
                        </>
                    )}
                </>
            )}
        </View>
    )
}
