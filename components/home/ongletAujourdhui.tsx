import { DateTime } from 'luxon'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dimensions, StyleSheet, Text, TouchableOpacity } from 'react-native'
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { useFont } from '@/contextes/contexteFont'
import { useGestionScroll } from '@/contextes/contexteGestionListes'
import { usePalette } from '@/contextes/contextePalette'
import { useInstantCourant } from '@/hooks/useInstantCourant'

// "Back to today" tab in the bottom bar (against the screen's edge): width and corner radius.
const LARGEUR_ONGLET = 52
const RAYON_ONGLET = 10
const { width: WIN_W } = Dimensions.get('window')

/**
 * Short month name of `dt` for the tab ("oct", "janv"), without the abbreviation dot.
 * Falls back to the first letters of the full name ('MMMM', as in the calendar) if the
 * short form isn't available.
 *
 * @author Philip — rectification for a more conventional display
 * @param {DateTime} dt
 * @returns {string}
 */
function abregerMois(dt: DateTime): string {
    const court = dt.toFormat('MMM')
    if (court && !court.includes('null')) return court.replace(/\.$/, '')
    return dt.toFormat('MMMM').slice(0, 4)
}

const styles = StyleSheet.create({
    onglet: {
        position: 'absolute',
        width: LARGEUR_ONGLET,
        height: 40,
        overflow: 'hidden',
    },
    bouton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texte: {
        fontSize: 16,
    },
    // The time ("14:37") and a month ("sept") are wider than a day number: smaller
    // so they fit the tab.
    texteLong: {
        fontSize: 13,
    },
    zoneTactile: { top: 8, bottom: 8, left: 4, right: 4 },
})

type Props = {
    /** Day displayed by the home screen. */
    todayDateTime: DateTime | undefined
    /** Back to today / now. Must be stable (e.g. reads a ref) so the tab isn't redrawn for it. */
    onPress: () => void
}

/**
 * "Back to today" tab in the bottom bar (replaces the floating arrows that sat on the
 * timeline). Shown when now isn't on screen (another day, or today scrolled away from
 * the current hour), on the side where now is — right when now is later (a past day),
 * left when now is earlier (a future day) — springing from one edge to the other and
 * fading in / out.
 *
 * It owns what only it uses (its visibility, its clock, its label): they were states of
 * the home screen, so every 30 s the whole screen redrew for a label.
 *
 * Label, by how far the displayed day is from today: the current time on today (timeline
 * scrolled away from now), today's day of the month in the same month, else today's
 * month abbreviation ("oct", "janv" — locale-aware).
 *
 * @author Philip — rectification for a more conventional display (moved out of the home screen)
 */
function OngletAujourdhuiImpl({ todayDateTime, onPress }: Props) {
    const { t } = useTranslation('home')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { afficherRetourMaintenant, LEFT_GO_TO_AFTER } = useGestionScroll()
    const maintenant = useInstantCourant()

    // jourRelatif: -1 past day, 0 today, 1 future day.
    const jourRelatif = useSharedValue(0)
    useEffect(() => {
        if (!todayDateTime) return
        const aujourdhui = DateTime.now().startOf('day')
        jourRelatif.set(todayDateTime < aujourdhui ? -1 : todayDateTime > aujourdhui ? 1 : 0)
    }, [todayDateTime, jourRelatif])

    // Mirrors the tab's visibility for touches (a faded-out tab mustn't catch taps).
    const [visible, setVisible] = useState(false)
    useAnimatedReaction(
        () => jourRelatif.get() !== 0 || afficherRetourMaintenant.get().afficher,
        (visibleUI, precedent) => {
            if (visibleUI !== precedent) scheduleOnRN(setVisible, visibleUI)
        }
    )

    const anime = useAnimatedStyle(() => {
        const afficher = jourRelatif.get() !== 0 || afficherRetourMaintenant.get().afficher
        const aDroite = jourRelatif.get() < 0
            || (jourRelatif.get() === 0 && afficherRetourMaintenant.get().left === LEFT_GO_TO_AFTER)
        // Only the side away from the screen's edge is rounded.
        const arrondiGauche = withTiming(aDroite ? RAYON_ONGLET : 0, { duration: 200 })
        const arrondiDroite = withTiming(aDroite ? 0 : RAYON_ONGLET, { duration: 200 })
        return {
            left: withSpring(aDroite ? WIN_W - LARGEUR_ONGLET : 0, { mass: 1.6, damping: 20 }),
            opacity: withTiming(afficher ? 1 : 0, { duration: 300 }),
            borderTopLeftRadius: arrondiGauche,
            borderBottomLeftRadius: arrondiGauche,
            borderTopRightRadius: arrondiDroite,
            borderBottomRightRadius: arrondiDroite,
        }
    })

    const surAujourdhui = !todayDateTime || todayDateTime.hasSame(maintenant, 'day')
    const dansLeMois = !todayDateTime || todayDateTime.hasSame(maintenant, 'month')
    const texte = surAujourdhui
        ? maintenant.toFormat('HH:mm')
        : dansLeMois
            ? String(maintenant.day)
            // 'MMM', not the standalone 'LLL': Hermes' Intl returns null for the latter
            // (the tab showed "null"); the calendar's 'MMMM' uses the same 'MMM' family.
            : abregerMois(maintenant)

    return (
        <Animated.View
            style={[styles.onglet, { backgroundColor: colors.secondary }, anime]}
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <TouchableOpacity
                style={styles.bouton}
                onPress={onPress}
                hitSlop={styles.zoneTactile}
                accessibilityRole="button"
                accessibilityLabel={surAujourdhui ? t('backToNow') : t('backToToday')}
            >
                <Text
                    style={[
                        styles.texte,
                        { color: colors.background, fontFamily: fonts.title },
                        !(dansLeMois && !surAujourdhui) && styles.texteLong,
                    ]}
                    numberOfLines={1}
                >
                    {texte}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    )
}

export default React.memo(OngletAujourdhuiImpl)