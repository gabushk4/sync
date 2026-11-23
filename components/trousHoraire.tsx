import Haptics from '@/abstractions/haptics'
import ToastAbs from '@/abstractions/toastAbs'
import SelectionGlissee from '@/components/selectionGlissee'
import { toastTypes } from '@/constants/toastConfig'
import { useFont } from '@/contextes/contexteFont'
import { useGestionScroll } from '@/contextes/contexteGestionListes'
import { usePalette } from '@/contextes/contextePalette'
import { useTimeline } from '@/contextes/contexteTimeline'
import { calculerTrous, PAS_SELECTION } from '@/functions/trousHoraire'
import { positionHeures } from '@/functions/positionTimeline'
import { PlageChoisie } from '@/hooks/useSelectionGlissee'
import { DateTime } from 'luxon'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import useTimelineLabelOffset from '@/hooks/useTimelineLabelOffset'

/** A range picked on the member's row (local DateTimes). Now defined with the shared selection. */
export type { PlageChoisie }

type Props = {
    /** Member's events (local DateTimes), holidays already left out. */
    evenements: { debut?: DateTime, fin?: DateTime }[]
    /** Window start (the row's displayedDate). */
    debutFenetre: DateTime
    /** Days the row holds. */
    jours: number
    /** The range kept selected (the home screen's "+" creates on it), or null. */
    selection: PlageChoisie | null
    /** A range was picked (or cleared: null). */
    onSelection: (plage: PlageChoisie | null) => void
}

/**
 * Background of the member's timeline row: every free stretch (no event) is a block
 * outlined in blue ("Available"), greyed out once elapsed ("Past date"). Holding a
 * free block then dragging selects a range (snapped to 15 minutes, kept inside the
 * block it started in). Releasing keeps it selected: the "+" button then creates on
 * that range (event, or unavailability by swiping), a tap on the row clears it.
 * Releasing on an existing event shows an error instead.
 * Holding the finger near the row's left or right edge scrolls the timeline slowly,
 * until the finger moves away, is released or the free block's end is reached.
 * Rendered behind the row's events (EventsList's `arrierePlan`): a touch on an event
 * still reaches the event, and a quick drag still scrolls the timeline (the
 * selection only starts after the hold).
 *
 * @author Philip — user story 20
 * @author Philip — user story 20 (rework): no "what to add?" menu on release anymore
 *   (the "+" uses the selection); the drag and the auto-scroll run on the UI thread
 *   (worklets on shared values, positions in row hours) instead of re-rendering on
 *   every finger move, and the hold is shorter (200 ms instead of 350)
 * @author Philip — the hold & drag itself moved to useSelectionGlissee / SelectionGlissee
 *   (gesture + highlight), shared with the invitation review; same behavior here
 *   (15-minute step, past blocks and releasing on an event refused)
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function TrousHoraire({ evenements, debutFenetre, jours, selection, onSelection }: Props) {
    const { t } = useTranslation('home')
    const { pxHeures, L_HEURES } = useTimeline()
    const cellule = pxHeures + L_HEURES

    const trous = useMemo(() => {
        const debut = debutFenetre.startOf('day')
        return calculerTrous(evenements, debut, debut.plus({ days: jours }))
    }, [evenements, debutFenetre, jours])
    // An elapsed block can't be selected (a warning instead).
    const zones = useMemo(() => trous.map((tr) => ({ debut: tr.debut, fin: tr.fin, refusee: tr.passe })), [trous])

    const avertirPasse = () => {
        Haptics.avertissement()
        ToastAbs.show({ type: toastTypes.warning, text1: t('plageLibre.passeTitre'), text2: t('plageLibre.passe') })
    }
    const avertirOccupe = () => {
        Haptics.erreur()
        ToastAbs.show({ type: toastTypes.error, text1: t('plageLibre.occupeTitre'), text2: t('plageLibre.occupe') })
    }

    const gauche = (date: DateTime) => positionHeures(date, debutFenetre) * cellule
    const largeur = (plage: { debut: DateTime, fin: DateTime }) => gauche(plage.fin) - gauche(plage.debut)

    return (
        <SelectionGlissee
            zones={zones}
            debutFenetre={debutFenetre}
            pasMinutes={PAS_SELECTION}
            selection={selection}
            onSelection={onSelection}
            // Released on an existing event: refused.
            obstacles={evenements}
            onDebutRefuse={avertirPasse}
            onFinRefusee={avertirOccupe}
        >
            {trous.map((trou) => (
                <BlocTrou
                    key={`${+trou.debut}-${+trou.fin}`}
                    passe={trou.passe}
                    left={gauche(trou.debut)}
                    width={largeur(trou)}
                    longueurTimeline={jours * 24 * cellule}
                    // The block holding the kept selection hides its label (the selection shows its hours).
                    masquerTexte={!!selection && selection.debut >= trou.debut && selection.fin <= trou.fin}
                />
            ))}
        </SelectionGlissee>
    )
}

/**
 * One free block: blue outline on a transparent background, like the common free
 * slots (FreeSlotItem), labelled "Available" ("Past date" once elapsed, greyed out).
 * The label sticks to the visible edge while the row scrolls.
 *
 * @author Philip — user story 20
 * @param {Object} props
 * @param {boolean} props.passe - Already elapsed.
 * @param {number} props.left - Position on the row (px).
 * @param {number} props.width - Width (px).
 * @param {number} props.longueurTimeline - Whole row's width (px).
 * @param {boolean} [props.masquerTexte=false] - Hides the label (block being selected).
 * @returns {JSX.Element}
 */
function BlocTrou({ passe, left, width, longueurTimeline, masquerTexte = false }: { passe: boolean, left: number, width: number, longueurTimeline: number, masquerTexte?: boolean }) {
    const { t } = useTranslation('home')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { pxHeures, L_HEURES } = useTimeline()
    const { offset } = useGestionScroll()

    const LARGEUR_TEXTE = 96
    const tailleTexte = Math.min(LARGEUR_TEXTE, width)
    const texteAnime = useTimelineLabelOffset({
        axis: 'x',
        itemOffset: left,
        itemSize: width,
        labelSize: tailleTexte,
        listOffset: offset,
        inset: pxHeures,
        centerThreshold: 2 * (pxHeures + L_HEURES),
        timelineLength: longueurTimeline,
    })

    const s = StyleSheet.create({
        bloc: {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left,
            width,
            borderWidth: 1,
            borderRadius: 8,
            borderColor: passe ? colors.muted : colors.disponible,
            backgroundColor: 'transparent',
            overflow: 'hidden',
            ...(passe ? { opacity: 0.45 } : {}),
        },
        texte: {
            position: 'absolute',
            left: 0,
            top: 0,
            width: tailleTexte,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
        },
        libelle: {
            fontFamily: fonts.title,
            fontSize: 16,
            textAlign: 'center',
            color: colors.muted,
        },
    })

    return (
        <View style={s.bloc}>
            <Animated.View style={[s.texte, texteAnime, masquerTexte && { opacity: 0 }]}>
                <Text style={s.libelle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>
                    {passe ? t('plageLibre.datePassee') : t('plageLibre.disponible')}
                </Text>
            </Animated.View>
        </View>
    )
}
