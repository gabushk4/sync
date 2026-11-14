import { DateTime } from 'luxon'
import { useEffect, useRef, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import Haptics from '@/abstractions/haptics'
import { useGestionScroll } from '@/contextes/contexteGestionListes'
import { useTimeline } from '@/contextes/contexteTimeline'
import { heuresVersDate, positionHeures } from '@/functions/positionTimeline'

/** Hold time (ms) before dragging selects a range instead of scrolling the timeline. */
const DELAI_APPUI_LONG = 200
/** Width (px) of the zone along each edge of the row where a held finger scrolls the timeline. */
const ZONE_BORD = 56
/** Auto-scroll speed (px/s): slow at the zone's inner limit, faster against the edge. */
const VITESSE_MIN = 60
const VITESSE_MAX = 260
/** Width (px) of the selection's hours label ("21:00 – 23:15"). */
const LARGEUR_TEXTE_SELECTION = 96

/** A range picked on a row (local DateTimes). */
export type PlageChoisie = { debut: DateTime, fin: DateTime }

/** Where a selection may start and stay (local DateTimes). */
export type ZoneSelection = {
    debut: DateTime
    fin: DateTime
    /** Holding there doesn't select: `onDebutRefuse` instead (e.g. already elapsed). */
    refusee?: boolean
}

export type ParamsSelectionGlissee = {
    /** Where a selection may start; it never leaves the zone it started in. Memoized by the caller. */
    zones: ZoneSelection[]
    /** Window start (the row's displayedDate). */
    debutFenetre: DateTime
    /** Step (minutes) the range's start and end snap to (15 on the home screen, 5 in the invitation review). */
    pasMinutes: number
    /** The range kept selected, or null (clears the highlight and stops a drag). */
    selection: PlageChoisie | null
    /** A range was picked on release (or cleared: null). */
    onSelection: (plage: PlageChoisie | null) => void
    /** Releasing over one of these refuses the range (`onFinRefusee`). Memoized by the caller. */
    obstacles?: { debut?: DateTime, fin?: DateTime }[]
    /** Held in a refused zone (e.g. already elapsed): a warning instead of a selection. */
    onDebutRefuse?: () => void
    /** Released over an obstacle (e.g. an existing event): the range is dropped. */
    onFinRefusee?: () => void
    /** Bounds of the shared scroll offset (a worklet): the screen's own, else the home screen's. */
    clampOffset?: (valeur: number) => number
    /** A tap on the row clears the kept selection (off where the screen clears it itself). */
    effacerAuToucher?: boolean
}

/**
 * Hold & drag selection of a range on a horizontal timeline row: holding a zone, then
 * dragging, selects a range snapped to `pasMinutes`, kept inside that zone; releasing
 * keeps it (`onSelection`). Holding the finger near the row's left or right edge
 * scrolls the timeline slowly, until the finger moves away, is released or the zone's
 * end is reached. The drag and the auto-scroll run on the UI thread (worklets on shared
 * values, positions in row hours); the hours label updates once per step.
 * Returns the gesture (for a GestureDetector over the whole row) and what the highlight
 * needs; SelectionGlissee puts both together.
 *
 * @author Philip — taken out of TrousHoraire (user story 20) to pick a precise range
 *   inside a common availability of the invitation review too; the step is a parameter
 * @param {ParamsSelectionGlissee} params
 * @returns {{ geste: ReturnType<typeof Gesture.Exclusive> | ReturnType<typeof Gesture.Pan>,
 *   styleSelection: object, styleEtiquette: object, etiquette: string }}
 */
export default function useSelectionGlissee({
    zones,
    debutFenetre,
    pasMinutes,
    selection,
    onSelection,
    obstacles,
    onDebutRefuse,
    onFinRefusee,
    clampOffset: clampOffsetEcran,
    effacerAuToucher = true,
}: ParamsSelectionGlissee) {
    const { pxHeures, L_HEURES } = useTimeline()
    const cellule = pxHeures + L_HEURES
    const { offset, clampOffset: clampOffsetAccueil } = useGestionScroll()
    const clampOffset = clampOffsetEcran ?? clampOffsetAccueil
    const { width: largeurEcran } = useWindowDimensions()
    /** Selection step, in hours. */
    const PAS_HEURES = pasMinutes / 60

    // Positions in row hours (wall-clock layout, see positionHeures), read by the worklets.
    const zonesH = useSharedValue<{ d: number, f: number, refusee: boolean }[]>([])
    const obstaclesH = useSharedValue<[number, number][]>([])
    useEffect(() => {
        zonesH.set(zones.map((z) => ({ d: positionHeures(z.debut, debutFenetre), f: positionHeures(z.fin, debutFenetre), refusee: !!z.refusee })))
        obstaclesH.set((obstacles ?? [])
            .filter((ev) => ev?.debut && ev?.fin)
            .map((ev) => [positionHeures(ev.debut!, debutFenetre), positionHeures(ev.fin!, debutFenetre)] as [number, number]))
    }, [zones, obstacles, debutFenetre, zonesH, obstaclesH])

    // Drag state (UI thread). selDebut < 0: nothing selected.
    const glisse = useSharedValue(false)
    const ancre = useSharedValue(0)
    const zoneD = useSharedValue(0)
    const zoneF = useSharedValue(0)
    const bordVue = useSharedValue(0)
    const doigt = useSharedValue(0)
    const selDebut = useSharedValue(-1)
    const selFin = useSharedValue(-1)
    const versFin = useSharedValue(true)
    const celluleSV = useSharedValue(cellule)
    const largeurSV = useSharedValue(largeurEcran)
    useEffect(() => { celluleSV.set(cellule) }, [cellule, celluleSV])
    useEffect(() => { largeurSV.set(largeurEcran) }, [largeurEcran, largeurSV])

    // Hours label of the range, updated once per step.
    const [etiquette, setEtiquette] = useState('')
    const etiquetter = (debutH: number, finH: number) => {
        setEtiquette(`${heuresVersDate(debutH, debutFenetre).toFormat('HH:mm')} – ${heuresVersDate(finH, debutFenetre).toFormat('HH:mm')}`)
    }

    // Cleared when the window moves: the positions were relative to the previous window.
    const fenetreRef = useRef(+debutFenetre.startOf('day'))
    useEffect(() => {
        if (fenetreRef.current !== +debutFenetre.startOf('day')) {
            fenetreRef.current = +debutFenetre.startOf('day')
            onSelection(null)
        }
    }, [debutFenetre, onSelection])

    /** Snapped range between the anchor and `h`, kept in the zone, at least one step. */
    const majSelection = (h: number) => {
        'worklet'
        const pas = Math.round(h / PAS_HEURES) * PAS_HEURES
        const bout = Math.min(Math.max(pas, zoneD.get()), zoneF.get())
        let debut: number, fin: number, versLaFin: boolean
        if (bout === ancre.get()) {
            const apres = Math.min(ancre.get() + PAS_HEURES, zoneF.get())
            if (apres > ancre.get()) { debut = ancre.get(); fin = apres; versLaFin = true }
            else { debut = Math.max(ancre.get() - PAS_HEURES, zoneD.get()); fin = ancre.get(); versLaFin = false }
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
    // the worklets don't capture the Haptics class nor the screen's callbacks themselves.
    const vibrerDebut = () => Haptics.click()
    const refuserDebut = () => onDebutRefuse?.()
    const refuserFin = () => onFinRefusee?.()
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
        // Nothing more to select past the zone's end: stop there.
        const h = heuresDoigt(doigt.get())
        if (versDroite ? h >= zoneF.get() : h <= zoneD.get()) return
        const profondeur = Math.min(1, Math.max(0, (ZONE_BORD - (versDroite ? distanceDroite : distanceGauche)) / ZONE_BORD))
        const vitesse = (VITESSE_MIN + profondeur * (VITESSE_MAX - VITESSE_MIN)) * (versDroite ? 1 : -1)
        const secondes = (frame.timeSincePreviousFrame ?? 16) / 1000
        offset.set(clampOffset(offset.get() + vitesse * secondes))
        majSelection(heuresDoigt(doigt.get()))
    }, false)
    const activerDefilement = (actif: boolean) => defilement.setActive(actif)

    // Cleared by the screen: no selection, and a drag in progress stops scrolling.
    // After `defilement`: the React Compiler lint rejects reading it before it's declared.
    // Only on `selection`: the label's re-renders during a drag (selection still null)
    // must not stop it.
    useEffect(() => {
        if (!selection) {
            glisse.set(false)
            selDebut.set(-1)
            selFin.set(-1)
            defilement.setActive(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selection])

    const appuiLong = Gesture.Pan()
        .activateAfterLongPress(DELAI_APPUI_LONG)
        .onStart((e) => {
            const h = e.x / celluleSV.get()
            const zone = zonesH.get().find((z) => h >= z.d && h < z.f)
            if (!zone) return
            if (zone.refusee) { scheduleOnRN(refuserDebut); return }
            scheduleOnRN(vibrerDebut)
            zoneD.set(zone.d)
            zoneF.set(zone.f)
            ancre.set(Math.min(Math.max(Math.floor(h / PAS_HEURES) * PAS_HEURES, zone.d), zone.f))
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
            const surObstacle = obstaclesH.get().some(([d, f]) => h >= d && h < f)
            if (!reussi || surObstacle) {
                selDebut.set(-1)
                selFin.set(-1)
                if (surObstacle) scheduleOnRN(refuserFin)
                scheduleOnRN(effacer)
                return
            }
            scheduleOnRN(valider, selDebut.get(), selFin.get())
        })

    // A tap on the row (not on an event) clears the kept selection.
    const toucher = Gesture.Tap().onEnd(() => {
        if (selDebut.get() >= 0 && !glisse.get()) scheduleOnRN(effacer)
    })

    const geste = effacerAuToucher ? Gesture.Exclusive(appuiLong, toucher) : appuiLong

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

    return { geste, styleSelection, styleEtiquette, etiquette }
}
