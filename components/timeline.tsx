import { DateTime } from "luxon"
import React, { useMemo, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, { scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedStyle } from "react-native-reanimated"

import { useFont } from "@/contextes/contexteFont"
import { useGestionScroll } from "@/contextes/contexteGestionListes"
import { usePalette } from '@/contextes/contextePalette'
import { useTimeline } from "@/contextes/contexteTimeline"

type TimelineProps = {
    horizontal: boolean
    windowStart?: DateTime
    selectedDate?: DateTime
    timelineDays?: number
    /** Scroll to `selectedDate` (or now) on first layout (default). The invitation
     * review screen scrolls to the event's hour itself, within its one-day bounds.
     * Philip — user story 8 (replaces EventsList's defilerMaintenant). */
    defilerAuDemarrage?: boolean
    /** Drawn in the hours' content (it scrolls with them): the current time's label. */
    premierPlan?: React.ReactNode
}

const styles = StyleSheet.create({
    // Horizontal: a clipping window (what the ScrollView's own frame was). It keeps the
    // ScrollView's default flex (grow + shrink) and fills the height of its row.
    fenetreH: {
        zIndex: 2,
        flexGrow: 1,
        flexShrink: 1,
        alignSelf: 'stretch',
        overflow: 'hidden',
    },
    contenuH: {
        flexDirection: 'row',
        height: '100%',
    },
    verticale: {
        zIndex: 2,
        paddingTop: 16,
    },
    contenuV: {
        backgroundColor: 'transparent',
        flexDirection: 'column',
    },
})

/**
 * The hours' cells (24 per day), built once. They only depend on the window, the
 * palette, the fonts and the sizes: they used to be rebuilt (168 views with a Text each,
 * on the home screen) every time the screen redrew.
 */
function useCellulesHeures(horizontal: boolean, windowStart: DateTime | undefined, timelineDays: number) {
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { pxHeures, L_HEURES, H_HEURES } = useTimeline()
    const debutMs = windowStart?.startOf('day').toMillis()

    return useMemo(() => {
        const dateBase = windowStart ?? DateTime.now().startOf('day').minus({ days: 3 })
        return Array.from({ length: timelineDays * 24 }, (_, index) => {
            const jour = Math.floor(index / 24)
            const heure = index % 24
            const now = dateBase.startOf('day').plus({ days: jour, hours: heure })
            const minuit = heure === 0
            return (
                <View
                    key={`h-${index}`}
                    style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'transparent',
                        ...(horizontal
                            ? { marginRight: pxHeures, width: L_HEURES, height: '100%', borderLeftWidth: minuit ? 1 : 0, borderColor: colors.muted }
                            : { marginBottom: pxHeures, height: H_HEURES, width: '100%' })
                    }}
                >
                    <Text
                        style={{
                            color: colors.text,
                            fontSize: minuit ? 12 : 16,
                            fontFamily: fonts.number,
                            // Horizontal: an hour's label is centered ON its hour, where the
                            // blocks and the current time line put that hour (positionHeures),
                            // so 2:30 is exactly halfway between "2:00" and "3:00". It used to
                            // be centered in its box, half a label (~12 min) after the hour.
                            // The day's label stays right of its midnight line.
                            ...(horizontal && !minuit ? { transform: [{ translateX: -L_HEURES / 2 }] } : {}),
                        }}
                    >
                        {minuit ? now.toFormat('ccc d') : `${heure}:00`}
                    </Text>
                </View>
            )
        })
        // windowStart is read through debutMs: a new DateTime for the same day rebuilds nothing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debutMs, horizontal, timelineDays, colors.text, colors.muted, fonts.number, pxHeures, L_HEURES, H_HEURES])
}

/**
 * Horizontal hours' row. Not a ScrollView any more: the hours sit in one layer translated
 * by the shared offset (one transform per frame, like the friends' rows), instead of a
 * scrollTo native command on every frame of a drag.
 */
function TimelineHorizontale({ windowStart, selectedDate, timelineDays = 1, defilerAuDemarrage = true, premierPlan }: TimelineProps) {
    const { pxHeures, L_HEURES } = useTimeline()
    const { offset } = useGestionScroll()
    const cellules = useCellulesHeures(true, windowStart, timelineDays)
    const initialisationFaite = useRef(false)

    const translation = useAnimatedStyle(() => ({
        transform: [{ translateX: -offset.get() }],
    }))

    return (
        <View
            pointerEvents="none"
            style={styles.fenetreH}
            onLayout={() => {
                if (initialisationFaite.current) return
                initialisationFaite.current = true
                if (!defilerAuDemarrage) return
                const cible = selectedDate ?? DateTime.now()
                const heureDansLaFenetre = windowStart
                    ? cible.diff(windowStart.startOf('day'), 'hours').hours
                    : cible.hour
                offset.set(Math.max(0, heureDansLaFenetre) * (pxHeures + L_HEURES))
            }}
        >
            <Animated.View style={[styles.contenuH, { width: timelineDays * 24 * (pxHeures + L_HEURES) }, translation]}>
                {cellules}
                {premierPlan}
            </Animated.View>
        </View>
    )
}

/**
 * Vertical hours' column (other screens): unchanged, still a ScrollView driven by scrollTo.
 */
function TimelineVerticale({ windowStart, selectedDate, timelineDays = 1, defilerAuDemarrage = true, premierPlan }: TimelineProps) {
    const { pxHeures, L_HEURES } = useTimeline()
    const { offset } = useGestionScroll()
    const cellules = useCellulesHeures(false, windowStart, timelineDays)

    const scrollViewRef = useAnimatedRef<Animated.ScrollView>()
    const initialisationFaite = useRef(false)

    useAnimatedReaction(
        () => offset.get(),
        (valeur) => scrollTo(scrollViewRef, 0, valeur, false)
    )

    return (
        <Animated.ScrollView
            style={[styles.verticale, { pointerEvents: 'none' }]}
            contentContainerStyle={styles.contenuV}
            ref={scrollViewRef}
            horizontal={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            onLayout={() => {
                if (initialisationFaite.current) return
                initialisationFaite.current = true
                if (!defilerAuDemarrage) return
                const cible = selectedDate ?? DateTime.now()
                const heureDansLaFenetre = windowStart
                    ? cible.diff(windowStart.startOf('day'), 'hours').hours
                    : cible.hour
                offset.set(Math.max(0, heureDansLaFenetre) * (pxHeures + L_HEURES))
            }}
        >
            {cellules}
            {premierPlan}
        </Animated.ScrollView>
    )
}

export default function Timeline(props: TimelineProps) {
    return props.horizontal ? <TimelineHorizontale {...props} /> : <TimelineVerticale {...props} />
}
