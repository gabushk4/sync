import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'
import { scheduleOnRN } from 'react-native-worklets'

import { usePalette } from '@/contextes/contextePalette'
import couleurTeinte from '@/functions/couleurTeinte'

/** Thickness (px) of the colored ring. */
const EPAISSEUR_ANNEAU = 30
/** Diameter (px) of the cursor on the ring. */
const TAILLE_CURSEUR = 34
/** Degrees per drawn piece of the ring (120 pieces). */
const PAS_SEGMENT = 3
/** Accessibility increment / decrement (degrees). */
const PAS_ACCESSIBILITE = 10

type Props = {
    /** Selected hue (0-359). */
    teinte: number
    /** A new hue was picked (whole degrees), while dragging too. */
    onChange: (teinte: number) => void
    /** Diameter (px). */
    taille?: number
}

/**
 * A point of a circle centered in a `taille` square, at `angle` degrees (0 at the top,
 * clockwise — like the hue on the wheel).
 *
 * @param {number} centre - Center (px, both axes).
 * @param {number} rayon
 * @param {number} angle - Degrees.
 * @returns {{ x: number, y: number }}
 */
function point(centre: number, rayon: number, angle: number) {
    const a = (angle * Math.PI) / 180
    return { x: centre + rayon * Math.sin(a), y: centre - rayon * Math.cos(a) }
}

/**
 * A hue wheel: a ring of every hue (red at the top, clockwise), a cursor on the picked
 * one, and the picked color in the middle. Touching or dragging anywhere on it picks the
 * hue under the finger's direction. Adjustable with a screen reader (± 10°).
 *
 * @author Philip — user story 49 (theme color wheel)
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function RoueTeinte({ teinte, onChange, taille = 240 }: Props) {
    const { t } = useTranslation('settings')
    const { colors } = usePalette()

    const centre = taille / 2
    const rayonExterieur = centre
    const rayonInterieur = centre - EPAISSEUR_ANNEAU
    // The cursor's center runs along the middle of the ring.
    const rayonCurseur = centre - EPAISSEUR_ANNEAU / 2

    // The cursor's angle (degrees), moved on the UI thread while dragging; the last whole
    // degree sent, so a drag only calls onChange when the hue really changes.
    const angle = useSharedValue(teinte)
    const dernierEnvoye = useSharedValue(Math.round(teinte) % 360)

    // Changed from outside (e.g. "reset to default"): the cursor follows.
    useEffect(() => {
        if (dernierEnvoye.get() !== teinte) {
            angle.set(teinte)
            dernierEnvoye.set(teinte)
        }
    }, [teinte, angle, dernierEnvoye])

    // The ring's pieces, drawn once per size: each a sector of the ring in its hue,
    // overlapping its neighbor a little so no hairline shows between them.
    const segments = useMemo(() => {
        const morceaux = []
        for (let debut = 0; debut < 360; debut += PAS_SEGMENT) {
            const fin = debut + PAS_SEGMENT + 0.6
            const e1 = point(centre, rayonExterieur, debut)
            const e2 = point(centre, rayonExterieur, fin)
            const i2 = point(centre, rayonInterieur, fin)
            const i1 = point(centre, rayonInterieur, debut)
            const d = `M ${e1.x} ${e1.y} A ${rayonExterieur} ${rayonExterieur} 0 0 1 ${e2.x} ${e2.y}`
                + ` L ${i2.x} ${i2.y} A ${rayonInterieur} ${rayonInterieur} 0 0 0 ${i1.x} ${i1.y} Z`
            morceaux.push(<Path key={debut} d={d} fill={couleurTeinte(debut + PAS_SEGMENT / 2)} />)
        }
        return morceaux
    }, [centre, rayonExterieur, rayonInterieur])

    // JS-thread callback scheduled by the worklet (scheduleOnRN).
    const changer = (nouvelle: number) => onChange(nouvelle)

    /**
     * The hue in the direction of a touch (relative to the wheel), set on the cursor right
     * away and sent when its whole degree changes. Ignored right at the center (no
     * direction there).
     *
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    const choisir = (x: number, y: number) => {
        'worklet'
        const dx = x - centre
        const dy = y - centre
        if (dx * dx + dy * dy < 100) return
        let degres = (Math.atan2(dx, -dy) * 180) / Math.PI
        if (degres < 0) degres += 360
        angle.set(degres)
        const entier = Math.round(degres) % 360
        if (entier !== dernierEnvoye.get()) {
            dernierEnvoye.set(entier)
            scheduleOnRN(changer, entier)
        }
    }

    // Starts on touch (no distance to cover): a tap picks too.
    const geste = Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => choisir(e.x, e.y))
        .onUpdate((e) => choisir(e.x, e.y))

    const styleCurseur = useAnimatedStyle(() => {
        const a = (angle.get() * Math.PI) / 180
        return {
            transform: [
                { translateX: centre + rayonCurseur * Math.sin(a) - TAILLE_CURSEUR / 2 },
                { translateY: centre - rayonCurseur * Math.cos(a) - TAILLE_CURSEUR / 2 },
            ],
        }
    })

    const couleur = couleurTeinte(teinte)

    const s = StyleSheet.create({
        roue: { width: taille, height: taille, alignSelf: 'center' },
        curseur: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: TAILLE_CURSEUR,
            height: TAILLE_CURSEUR,
            borderRadius: TAILLE_CURSEUR / 2,
            borderWidth: 3,
            borderColor: colors.card,
            backgroundColor: couleur,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 1 },
            elevation: 4,
        },
    })

    return (
        <GestureDetector gesture={geste}>
            <View
                style={s.roue}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={t('themePicker.wheel')}
                accessibilityValue={{ min: 0, max: 359, now: Math.round(teinte) }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) => {
                    const pas = e.nativeEvent.actionName === 'increment' ? PAS_ACCESSIBILITE : -PAS_ACCESSIBILITE
                    onChange((Math.round(teinte) + pas + 360) % 360)
                }}
            >
                <Svg width={taille} height={taille}>
                    {segments}
                    {/* The picked color in the middle. */}
                    <Circle cx={centre} cy={centre} r={rayonInterieur - 14} fill={couleur} stroke={colors.border} strokeWidth={StyleSheet.hairlineWidth} />
                </Svg>
                <Animated.View pointerEvents="none" style={[s.curseur, styleCurseur]} />
            </View>
        </GestureDetector>
    )
}
