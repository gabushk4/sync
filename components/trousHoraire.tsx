import Haptics from '@/abstractions/haptics'
import ToastAbs from '@/abstractions/toastAbs'
import { toastTypes } from '@/constants/toastConfig'
import { useFont } from '@/contextes/contexteFont'
import { useGestionScroll } from '@/contextes/contexteGestionListes'
import { usePalette } from '@/contextes/contextePalette'
import { useTimeline } from '@/contextes/contexteTimeline'
import { calculerTrous, PAS_SELECTION } from '@/functions/trousHoraire'
import { heuresVersDate, positionHeures } from '@/functions/positionTimeline'
import { DateTime } from 'luxon'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import useTimelineLabelOffset from '@/hooks/useTimelineLabelOffset'

/** Hold time (ms) before dragging selects a range instead of scrolling the timeline. */
const DELAI_APPUI_LONG = 200
/** Width (px) of the zone along each edge of the row where a held finger scrolls the timeline. */
const ZONE_BORD = 56
/** Auto-scroll speed (px/s): slow at the zone's inner limit, faster against the edge. */
const VITESSE_MIN = 60
const VITESSE_MAX = 260
/** Selection step, in hours (PAS_SELECTION minutes). */
const PAS_HEURES = PAS_SELECTION / 60

/** Width (px) of the selection's hours label ("21:00 – 23:15"). */
const LARGEUR_TEXTE_SELECTION = 96

/** A range picked on the member's row (local DateTimes). */
export type PlageChoisie = { debut: DateTime, fin: DateTime }

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
 * @param {Props} props
 * @returns {JSX.Element}
 */
export default function TrousHoraire({ evenements, debutFenetre, jours, selection, onSelection }: Props) {
    const { t } = useTranslation('home')
    const { colors } = usePalette()
    const { fonts } = useFont()
    const { pxHeures, L_HEURES } = useTimeline()
    const cellule = pxHeures + L_HEURES
    const { offset, clampOffset } = useGestionScroll()
    const { width: largeurEcran } = useWindowDimensions()

    const trous = useMemo(() => {
        const debut = debutFenetre.startOf('day')
        return calculerTrous(evenements, debut, debut.plus({ days: jours }))
    }, [evenements, debutFenetre, jours])

    // Positions in row hours (wall-clock layout, see positionHeures), read by the worklets.
    const trousH = useSharedValue<{ d: number, f: number, passe: boolean }[]>([])
    const occupesH = useSharedValue<[number, number][]>([])
    useEffect(() => {
        trousH.set(trous.map((tr) => ({ d: positionHeures(tr.debut, debutFenetre), f: positionHeures(tr.fin, debutFenetre), passe: tr.passe })))
        occupesH.set(evenements
            .filter((ev) => ev?.debut && ev?.fin)
            .map((ev) => [positionHeures(ev.debut!, debutFenetre), positionHeures(ev.fin!, debutFenetre)] as [number, number]))
    }, [trous, evenements, debutFenetre])

    // Drag state (UI thread). selDebut < 0: nothing selected.
    const glisse = useSharedValue(false)
    const ancre = useSharedValue(0)
    const trouD = useSharedValue(0)
    const trouF = useSharedValue(0)
    const bordVue = useSharedValue(0)
    const doigt = useSharedValue(0)
    const selDebut = useSharedValue(-1)
    const selFin = useSharedValue(-1)
    const versFin = useSharedValue(true)
    const celluleSV = useSharedValue(cellule)
    const largeurSV = useSharedValue(largeurEcran)
    useEffect(() => { celluleSV.set(cellule)}, [cellule])
    useEffect(() => { largeurSV.set(largeurEcran)}, [largeurEcran])

    // Hours label of the range, updated once per 15-minute step.
    const [etiquette, setEtiquette] = useState('')
    const etiquetter = (debutH: number, finH: number) => {
        setEtiquette(`${heuresVersDate(debutH, debutFenetre).toFormat('HH:mm')} – ${heuresVersDate(finH, debutFenetre).toFormat('HH:mm')}`)
    }

    // Cleared by the home screen (left, other day) or when the window moves: the
    // positions were relative to the previous window.
    const fenetreRef = useRef(+debutFenetre.startOf('day'))
    useEffect(() => {
        if (fenetreRef.current !== +debutFenetre.startOf('day')) {
            fenetreRef.current = +debutFenetre.startOf('day')
            onSelection(null)
        }
    }, [debutFenetre])
    /** Snapped range between the anchor and `h`, kept in the free block, at least one step. */
    const majSelection = (h: number) => {
        'worklet'
        const pas = Math.round(h / PAS_HEURES) * PAS_HEURES
        const bout = Math.min(Math.max(pas, trouD.get()), trouF.get())
        let debut: number, fin: number, versLaFin: boolean
        if (bout === ancre.get()) {
            const apres = Math.min(ancre.get() + PAS_HEURES, trouF.get())
            if (apres > ancre.get()) { debut = ancre.get(); fin = apres; versLaFin = true }
            else { debut = Math.max(ancre.get() - PAS_HEURES, trouD.get()); fin = ancre.get(); versLaFin = false }
        } else if (bout < ancre.get()) { debut = bout; fin = ancre.get(); versLaFin = false }
        else { debut = ancre.get(); fin = bout; versLaFin = true }
        if (debut !== selDebut.get() || fin !== selFin.get()) {
            selDebut.set(debut)
            selFin.set(fin)
            scheduleOnRN(etiquetter, debut, fin)
        }
        versFin.set(versLaFin)
    }

    /** Finger's screen x → row hours (follows the auto-scroll under a still finger). */
    const heuresDoigt = (absoluteX: number) => {
        'worklet'
        return (absoluteX - bordVue.get() + offset.get()) / celluleSV.get()
    }

    // JS-thread callbacks scheduled by the worklets (scheduleOnRN): local functions, so
    // the worklets don't capture the Haptics / ToastAbs classes themselves.
    const vibrerDebut = () => Haptics.click()
    const avertirPasse = () => {
        Haptics.avertissement()
        ToastAbs.show({ type: toastTypes.warning, text1: t('plageLibre.passeTitre'), text2: t('plageLibre.passe') })
    }
    const avertirOccupe = () => {
        Haptics.erreur()
        ToastAbs.show({ type: toastTypes.error, text1: t('plageLibre.occupeTitre'), text2: t('plageLibre.occupe') })
    }
    const valider = (debutH: number, finH: number) => {
        Haptics.clickLeger()
        onSelection({ debut: heuresVersDate(debutH, debutFenetre), fin: heuresVersDate(finH, debutFenetre) })
    }
    const effacer = () => onSelection(null)

    // Auto-scroll: while the held finger sits near an edge of the row, the timeline
    // scrolls that way and the selection follows (every frame, UI thread). Only active
    // during a drag (activerDefilement), not on every frame of the app.
    const defilement = useFrameCallback((frame) => {
        if (!glisse.get()) return
        const distanceDroite = largeurSV.get() - doigt.get()
        const distanceGauche = doigt.get() - bordVue.get()
        const versDroite = distanceDroite < ZONE_BORD
        if (!versDroite && distanceGauche >= ZONE_BORD) return
        // Nothing more to select past the free block's end: stop there.
        const h = heuresDoigt(doigt.get())
        if (versDroite ? h >= trouF.get() : h <= trouD.get()) return
        const profondeur = Math.min(1, Math.max(0, (ZONE_BORD - (versDroite ? distanceDroite : distanceGauche)) / ZONE_BORD))
        const vitesse = (VITESSE_MIN + profondeur * (VITESSE_MAX - VITESSE_MIN)) * (versDroite ? 1 : -1)
        const secondes = (frame.timeSincePreviousFrame ?? 16) / 1000
        offset.set(clampOffset(offset.get() + vitesse * secondes))
        majSelection(heuresDoigt(doigt.get()))
    }, false)
    const activerDefilement = (actif: boolean) => defilement.setActive(actif)

    // Cleared by the home screen: no selection, and a drag in progress stops scrolling.
    // After `defilement`: the React Compiler lint rejects reading it before it's declared.
    useEffect(() => {
        if (!selection) {
            glisse.set(false)
            selDebut.set(-1)
            selFin.set(-1)
            defilement.setActive(false)
        }
    }, [selection])

    const appuiLong = Gesture.Pan()
        .activateAfterLongPress(DELAI_APPUI_LONG)
        .onStart((e) => {
            const h = e.x / celluleSV.get()
            const trou = trousH.get().find((tr) => h >= tr.d && h < tr.f)
            if (!trou) return
            if (trou.passe) { scheduleOnRN(avertirPasse); return }
            scheduleOnRN(vibrerDebut)
            trouD.set(trou.d)
            trouF.set(trou.f)
            ancre.set(Math.min(Math.max(Math.floor(h / PAS_HEURES) * PAS_HEURES, trou.d), trou.f))
            bordVue.set(e.absoluteX - e.x + offset.get())
            doigt.set(e.absoluteX)
            selDebut.set(-1)
            glisse.set(true)
            scheduleOnRN(activerDefilement, true)
            majSelection(ancre.get())
        })
        .onUpdate((e) => {
            if (!glisse.get()) return
            doigt.set(e.absoluteX)
            majSelection(heuresDoigt(e.absoluteX))
        })
        .onEnd((e, reussi) => {
            if (!glisse.get()) return
            glisse.set(false)
            scheduleOnRN(activerDefilement, false)
            const h = heuresDoigt(e.absoluteX)
            const surEvenement = occupesH.get().some(([d, f]) => h >= d && h < f)
            if (!reussi || surEvenement) {
                selDebut.set(-1)
                selFin.set(-1)
                if (surEvenement) scheduleOnRN(avertirOccupe)
                scheduleOnRN(effacer)
                return
            }
            scheduleOnRN(valider, selDebut.get(), selFin.get())
        })

    // A tap on the row (not on an event) clears the kept selection.
    const toucher = Gesture.Tap().onEnd(() => {
        if (selDebut.get() >= 0 && !glisse.get()) scheduleOnRN(effacer)
    })

    const geste = Gesture.Exclusive(appuiLong, toucher)

    const styleSelection = useAnimatedStyle(() => {
        const visible = selDebut.get() >= 0
        const left = selDebut.get() * celluleSV.get()
        const width = visible ? (selFin.get() - selDebut.get()) * celluleSV.get() : 0
        return { left, width, opacity: visible ? 1 : 0 }
    })
    // Hours label against the end following the finger (the visible side, also while
    // auto-scrolling), centered only when the range is narrower.
    const styleEtiquette = useAnimatedStyle(() => {
        const width = Math.max((selFin.get() - selDebut.get()) * celluleSV.get(), 0)
        const largeurTexte = Math.min(LARGEUR_TEXTE_SELECTION, width)
        return { width: largeurTexte, left: versFin.get() ? width - largeurTexte : 0 }
    })

    const gauche = (date: DateTime) => positionHeures(date, debutFenetre) * cellule
    const largeur = (plage: { debut: DateTime, fin: DateTime }) => gauche(plage.fin) - gauche(plage.debut)

    const s = StyleSheet.create({
        selection: {
            position: 'absolute',
            top: 0,
            bottom: 0,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: colors.secondary,
            backgroundColor: colors.primary,
            overflow: 'hidden',
        },
        etiquette: {
            position: 'absolute',
            top: 0,
            bottom: 0,
            justifyContent: 'center',
        },
        texteSelection: {
            color: colors.text,
            fontFamily: fonts.number,
            fontSize: 12,
            textAlign: 'center',
            paddingHorizontal: 2,
        },
    })

    return (
        <GestureDetector gesture={geste}>
            <View style={StyleSheet.absoluteFill}>
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
                <Animated.View style={[s.selection, styleSelection]} pointerEvents="none">
                    <Animated.View style={[s.etiquette, styleEtiquette]}>
                        <Text style={s.texteSelection} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                            {etiquette}
                        </Text>
                    </Animated.View>
                </Animated.View>
            </View>
        </GestureDetector>
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
