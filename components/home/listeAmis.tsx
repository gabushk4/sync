import Ionicons from '@react-native-vector-icons/ionicons'
import { router } from 'expo-router'
import { DateTime } from 'luxon'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, { AnimatedRef, SharedValue, useAnimatedStyle } from 'react-native-reanimated'

import { PhotoAmi, RangeeAmi } from '@/components/home/ligneAmi'
import Spinner from '@/components/spinner'
import { JOURS_FENETRE, LIST_HEIGHT, WIDTH_COL } from '@/constants/Timeline'
import { useFont } from '@/contextes/contexteFont'
import { useGestionScroll } from '@/contextes/contexteGestionListes'
import { usePalette } from '@/contextes/contextePalette'
import { useTimeline } from '@/contextes/contexteTimeline'
import { getCommonFreeSlotsSurPlage } from '@/functions/availability'
import normaliserRecherche from '@/functions/normaliserRecherche'
import { useInstantCourant } from '@/hooks/useInstantCourant'

// Required once, at module scope (both branches pointed to the dark icon already).
const ICONE_AJOUTER_AMI = require('@/assets/icones/ajouter-ami-dark-icon.png')

const styles = StyleSheet.create({
    placeholder: {
        height: '100%',
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    placeholderTexte: {
        fontSize: 18,
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    iconeAjouter: {
        height: 64,
        width: 64,
    },
    chargementPlus: {
        height: LIST_HEIGHT / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Photos on the left (fixed), timelines on the right (one translated layer).
    corps: {
        flexDirection: 'row',
    },
    colonnePhotos: {
        width: WIDTH_COL,
    },
    // Clips the translated layer, like each row's ScrollView did.
    fenetre: {
        flex: 1,
        overflow: 'hidden',
    },
})

type Props = {
    friends: any[]
    /** The member's events (holidays excluded): the common free slots are computed against them. */
    evenementsHoraire: any[]
    windowStart: DateTime
    /** Both full window responses are loaded: shared availability can be shown. */
    dispoCommunesPossibles: boolean
    rechercheOuverte: boolean
    texteRecherche: string
    /** The search the last friends' answer was for: "no result" waits for it. */
    rechercheRepondue: string
    chargementPlusAmis: boolean
    /** The home screen scrolls the rows vertically (scrollTo from its gesture). */
    scrollRef: AnimatedRef<Animated.ScrollView>
    /** Max vertical offset, written here (it depends on how many rows are shown). */
    maxY: SharedValue<number>
}

/**
 * The friends' rows of the home screen: common free slots with the member, ranking
 * (close friends first, then most shared time, then soonest, then pseudo), the live
 * search filter, and the empty / "no result" states. It owns the ranking's clock.
 *
 * Horizontal scroll: the timelines of ALL the friends live in one layer translated by
 * the shared offset (one transform per frame), instead of one ScrollView + scrollTo per
 * row. The photos stay in their own fixed column; both columns are made of rows of the
 * same height, so they line up. Both scroll vertically together (one ScrollView).
 *
 * The ranking uses the shared 30 s clock (it was 60 s). Rows are memoized, so a
 * re-ranking that keeps the same order redraws no row.
 */
function ListeAmisImpl({
    friends, evenementsHoraire, windowStart, dispoCommunesPossibles,
    rechercheOuverte, texteRecherche, rechercheRepondue, chargementPlusAmis,
    scrollRef, maxY,
}: Props) {
    const { t } = useTranslation('home')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { offset } = useGestionScroll()
    const { pxHeures, L_HEURES } = useTimeline()
    const maintenant = useInstantCourant()
    const zoneH = useRef(0)

    // The layer follows the shared offset: one style, one transform per frame.
    const translation = useAnimatedStyle(() => ({
        transform: [{ translateX: -offset.get() }],
    }))

    const disponibilitesAmis = useMemo(() => friends.map((ami) => ({
        ami,
        commonFreeSlots: dispoCommunesPossibles && !ami.bloque_par_moi
            ? getCommonFreeSlotsSurPlage(evenementsHoraire, ami.evenements, windowStart, JOURS_FENETRE)
            : [],
    })), [friends, dispoCommunesPossibles, evenementsHoraire, windowStart])

    const amisAvecDisponibilites = useMemo(() => {
        return disponibilitesAmis.map(({ ami, commonFreeSlots }) => {
            const aVenir: any[] = commonFreeSlots.filter((slot: any) => !slot.passe && slot.end > maintenant)
            const minutesCommunes = aVenir.reduce((total: number, slot: any) => {
                const debutUtile = slot.start > maintenant ? slot.start : maintenant
                return total + Math.max(0, slot.end.diff(debutUtile, 'minutes').minutes)
            }, 0)
            const prochaineDisponibilite = aVenir.length > 0
                ? Math.max(0, aVenir[0].start.diff(maintenant, 'minutes').minutes)
                : Number.POSITIVE_INFINITY
            return { ami, commonFreeSlots, minutesCommunes, prochaineDisponibilite }
        }).sort((a, b) =>
            Number(!!b.ami.proche) - Number(!!a.ami.proche)
            || b.minutesCommunes - a.minutesCommunes
            || a.prochaineDisponibilite - b.prochaineDisponibilite
            || String(a.ami.pseudo ?? '').localeCompare(String(b.ami.pseudo ?? ''))
        )
    }, [disponibilitesAmis, maintenant])

    // Keep the availability ranking in the rendered list, then apply the current
    // search without changing that order (case and accents ignored, like the API).
    const motifRecherche = useMemo(() => normaliserRecherche(texteRecherche), [texteRecherche])
    const amisAffiches = useMemo(() => (
        rechercheOuverte && motifRecherche
            ? amisAvecDisponibilites.filter(({ ami }) => normaliserRecherche(ami.pseudo ?? '').includes(motifRecherche))
            : amisAvecDisponibilites
    ), [amisAvecDisponibilites, rechercheOuverte, motifRecherche])

    const aucunResultat = rechercheOuverte && !!motifRecherche && amisAffiches.length === 0
        && rechercheRepondue === texteRecherche.trim()

    // The vertical scroll limit depends on how many rows are shown and on the zone's height.
    const majMaxY = useCallback(() => {
        maxY.set(Math.max(0, amisAffiches.length * (LIST_HEIGHT + 4) - zoneH.current))
    }, [amisAffiches.length, maxY])
    useEffect(() => { majMaxY() }, [majMaxY])

    const couleurTexte = useMemo(() => ({ color: colors.text, fontFamily: fonts.title }), [colors.text, fonts.title])

    if (aucunResultat) {
        // No friend matches the search (user story 22).
        return (
            <View style={styles.placeholder}>
                <Ionicons name="search-outline" size={32} color={colors.muted} />
                <Text style={[styles.placeholderTexte, couleurTexte]}>
                    {t('search.noResult', { texte: texteRecherche.trim() })}
                </Text>
            </View>
        )
    }

    if (friends.length === 0 && !rechercheOuverte) {
        return (
            <View style={styles.placeholder}>
                <Text style={[styles.placeholderTexte, couleurTexte]}>
                    {t('friendsListEmptyState')}
                </Text>
                <TouchableOpacity onPress={() => router.push('/(modals)/ajouterAmi')}>
                    <Image source={ICONE_AJOUTER_AMI} style={styles.iconeAjouter} resizeMode="contain" />
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <Animated.ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            onLayout={(e) => {
                zoneH.current = e.nativeEvent.layout.height
                majMaxY()
            }}
        >
            <View style={styles.corps}>
                <View style={styles.colonnePhotos}>
                    {amisAffiches.map(({ ami }) => (
                        <PhotoAmi key={ami.id} friend={ami} />
                    ))}
                </View>
                <View style={styles.fenetre}>
                    <Animated.View style={[{ width: JOURS_FENETRE * 24 * (pxHeures + L_HEURES) }, translation]}>
                        {amisAffiches.map(({ ami, commonFreeSlots }) => (
                            <RangeeAmi
                                key={ami.id}
                                friend={ami}
                                commonFreeSlots={commonFreeSlots}
                                windowStart={windowStart}
                            />
                        ))}
                    </Animated.View>
                </View>
            </View>
            {/* the next 10 friends on their way */}
            {chargementPlusAmis && (
                <View style={styles.chargementPlus}>
                    <Spinner size={24} color={colors.muted} />
                </View>
            )}
        </Animated.ScrollView>
    )
}

export default React.memo(ListeAmisImpl)