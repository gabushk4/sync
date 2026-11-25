import { DateTime } from 'luxon'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { scrollTo, SharedValue, useAnimatedReaction, useAnimatedRef } from 'react-native-reanimated'

import { JOURS_FENETRE, LARGEUR_HEURE_MAINTENANT, WIDTH_COL } from '@/constants/Timeline'
import { useFont } from '@/contextes/contexteFont'
import { usePalette } from '@/contextes/contextePalette'
import { useTimeline } from '@/contextes/contexteTimeline'
import { convertirTimestampHeure } from '@/functions/convertirTimestamp'
import { positionHeures } from '@/functions/positionTimeline'
import { useInstantCourant } from '@/hooks/useInstantCourant'

const styles = StyleSheet.create({
    bandeMaintenant: {
        position: 'absolute',
        left: WIDTH_COL,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 10,
    },
    contenuBande: {
        height: '100%',
    },
    ligneMaintenant: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 2,
        zIndex: 10,
    },
    heureMaintenant: {
        position: 'absolute',
        bottom: 2,
        width: LARGEUR_HEURE_MAINTENANT,
        paddingVertical: 1,
        borderRadius: 6,
        alignItems: 'center',
        zIndex: 10,
    },
    texteHeureMaintenant: {
        color: '#fff',
        fontSize: 11,
    },
})

type LigneProps = {
    offsetX: SharedValue<number>
    windowStart: DateTime
}

/**
 * The current time line, over every row (full height, no gaps between rows): a
 * see-through strip scrolled exactly like the rows (scrollTo from the shared offset),
 * the line at the current time in it. Drawn at the same place as an event at this time
 * would be (positionHeures). Owns its clock: the home screen no longer redraws every 30 s.
 */
function LigneMaintenantImpl({ offsetX, windowStart }: LigneProps) {
    const { colors } = usePalette()
    const { pxHeures, L_HEURES } = useTimeline()
    const instant = useInstantCourant()

    const ref = useAnimatedRef<Animated.ScrollView>()
    useAnimatedReaction(
        () => offsetX.get(),
        (offset) => scrollTo(ref, offset, 0, false)
    )

    const debutFenetre = windowStart.startOf('day')
    const visible = instant >= debutFenetre && instant < debutFenetre.plus({ days: JOURS_FENETRE })
    const x = positionHeures(instant, windowStart) * (pxHeures + L_HEURES)

    return (
        <Animated.ScrollView
            ref={ref}
            horizontal
            scrollEnabled={false}
            pointerEvents="none"
            showsHorizontalScrollIndicator={false}
            style={styles.bandeMaintenant}
            contentContainerStyle={styles.contenuBande}
        >
            <View style={{ width: JOURS_FENETRE * 24 * (pxHeures + L_HEURES), height: '100%' }}>
                {visible && <View style={[styles.ligneMaintenant, { left: x - 1, backgroundColor: colors.error }]} />}
            </View>
        </Animated.ScrollView>
    )
}
export const LigneMaintenant = React.memo(LigneMaintenantImpl)

type HeureProps = {
    windowStart: DateTime
}

/**
 * The current time's label, in the hours' row (passed to Timeline as `premierPlan`).
 * Renders nothing when now is outside the loaded window. Same clock as the line.
 */
function HeureMaintenantImpl({ windowStart }: HeureProps) {
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { pxHeures, L_HEURES } = useTimeline()
    const instant = useInstantCourant()

    const debutFenetre = windowStart.startOf('day')
    if (!(instant >= debutFenetre && instant < debutFenetre.plus({ days: JOURS_FENETRE }))) return null
    const x = positionHeures(instant, windowStart) * (pxHeures + L_HEURES)

    return (
        <View
            pointerEvents="none"
            style={[styles.heureMaintenant, { left: x - LARGEUR_HEURE_MAINTENANT / 2, backgroundColor: colors.error }]}
        >
            <Text style={[styles.texteHeureMaintenant, { fontFamily: fonts.number }]}>
                {convertirTimestampHeure(instant)}
            </Text>
        </View>
    )
}
export const HeureMaintenant = React.memo(HeureMaintenantImpl)